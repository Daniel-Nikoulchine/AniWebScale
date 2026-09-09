// E4 phase 1: hand-written Vulkan SRVGG backend. See srvgg-vulkan.h.
// Mirrors the spike's proven VkCompute/VkMat patterns (one VkCompute per
// call owned by the caller, blob-pooled buffers, persistent pipelines).

#include "srvgg-vulkan.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <fstream>
#include <sstream>

#include "anime4k/json.hpp"
#include "command.h"
#include "gpu.h"
#include "mat.h"
#include "net.h"
#include "pipeline.h"

#include "srvgg_conv.comp.hex.h"
#include "srvgg_tail.comp.hex.h"
#include "srvgg_conv_tiled.comp.hex.h"

SrvggVulkan::SrvggVulkan(ncnn::VulkanDevice* device, ncnn::VkAllocator* blob, ncnn::VkAllocator* staging)
    : device_(device), blob_(blob), staging_(staging) {}

SrvggVulkan::~SrvggVulkan() {
    delete tailPipe_;
    delete tiledPipe_;
    delete convPipe_;
    delete dummy_;
    delete weightsGpu_;
    delete weightsCpu_;
}

bool SrvggVulkan::ensure(const std::string& modelsDir, std::string& err) {
    if (ready_) return true;
    if (weightsUnavailable_) {
        err = "srvgg weights unavailable (latched from an earlier attempt)";
        return false;
    }
    // Tiled is the serving path (gated vs naive + ncnn); naive stays as the
    // env-selectable reference (ANIWEBSCALE_SRVGG_CONV=naive).
    useTiled_ = true;
    if (const char* e = std::getenv("ANIWEBSCALE_SRVGG_CONV")) {
        const std::string mode(e);
        useTiled_ = (mode == "tiled");
    }
    if (!loadWeights(modelsDir, err)) {
        // Missing weights never come back mid-process: latch so the per-frame
        // fallback does not re-open the files (and re-log) every frame.
        weightsUnavailable_ = true;
        return false;
    }
    if (!createPipelines(err)) return false;
    ready_ = true;
    fprintf(stderr, "[srvgg] backend ready (%zu conv layers, %s path)\n",
            layers_.size(), (useTiled_ ? "tiled-fp16" : "naive-fp32"));
    return true;
}

static bool readWholeFile(const std::string& path, std::vector<unsigned char>& out, std::string& err) {
    std::ifstream file(path, std::ios::binary | std::ios::ate);
    if (!file) {
        err = "cannot open " + path;
        return false;
    }
    const std::streamsize size = file.tellg();
    if (size <= 0) {
        err = "empty file " + path;
        return false;
    }
    // Weight/manifest files are tens of MB at most; refuse absurd sizes
    // before the resize below can OOM the host on a corrupt path.
    constexpr std::streamsize kMaxWeightFileBytes = 64 * 1024 * 1024;
    if (size > kMaxWeightFileBytes) {
        err = "file too large " + path;
        return false;
    }
    file.seekg(0, std::ios::beg);
    out.resize(static_cast<size_t>(size));
    if (!file.read(reinterpret_cast<char*>(out.data()), size)) {
        err = "cannot read " + path;
        return false;
    }
    return true;
}

bool SrvggVulkan::loadWeights(const std::string& modelsDir, std::string& err) {
    if (weightsCpu_) return true;
    const std::string manifestPath = modelsDir + "/srvgg-animevideo-v3-x4.json";
    const std::string binPath = modelsDir + "/srvgg-animevideo-v3-x4.f32.bin";
    std::vector<unsigned char> manifestBytes;
    if (!readWholeFile(manifestPath, manifestBytes, err)) return false;
    std::vector<unsigned char> binBytes;
    if (!readWholeFile(binPath, binBytes, err)) return false;

    auto parsed = anime4k::json::parse(
        std::string(reinterpret_cast<const char*>(manifestBytes.data()), manifestBytes.size()));
    if (!parsed.value || !parsed.value->is_object()) {
        err = "srvgg manifest is not a JSON object: " + parsed.error;
        return false;
    }
    const anime4k::json::Object& manifest = *parsed.value->as_object();
    const auto totalIt = manifest.find("totalFloats");
    if (totalIt == manifest.end() || !totalIt->second.as_number()) {
        err = "srvgg manifest has no totalFloats";
        return false;
    }
    // Integral and sane before any multiply/alloc below: a fractional value
    // would truncate, a huge one wrap totalFloats*4 past the bin-size check
    // and narrow again into the Mat below.
    const double totalFloatsDouble = *totalIt->second.as_number();
    if (!(totalFloatsDouble >= 0) || totalFloatsDouble != std::floor(totalFloatsDouble)
        || totalFloatsDouble > 64 * 1024 * 1024) {
        err = "srvgg manifest totalFloats out of range";
        return false;
    }
    const size_t totalFloats = static_cast<size_t>(totalFloatsDouble);
    if (binBytes.size() != totalFloats * 4) {
        std::ostringstream message;
        message << "srvgg bin holds " << binBytes.size() << " bytes; manifest needs " << (totalFloats * 4);
        err = message.str();
        return false;
    }
    const auto layersIt = manifest.find("layers");
    if (layersIt == manifest.end() || !layersIt->second.is_array()) {
        err = "srvgg manifest has no layers array";
        return false;
    }
    struct RawSlope { int offset = 0; };
    std::vector<SrvggConvLayer> convs;
    std::vector<RawSlope> slopes;
    for (const anime4k::json::Value& entry : *layersIt->second.as_array()) {
        if (!entry.is_object()) {
            err = "srvgg manifest layer is not an object";
            return false;
        }
        const anime4k::json::Object& layer = *entry.as_object();
        const auto kindIt = layer.find("kind");
        const std::string kind = (kindIt != layer.end() && kindIt->second.as_string())
            ? *kindIt->second.as_string() : "";
        auto getInt = [&](const char* key, int& dst) -> bool {
            const auto it = layer.find(key);
            if (it == layer.end() || !it->second.as_number()) {
                err = std::string("srvgg layer misses numeric ") + key;
                return false;
            }
            dst = static_cast<int>(*it->second.as_number());
            return true;
        };
        if (kind == "conv") {
            SrvggConvLayer conv;
            int hasPrelu = 0;
            const auto hpIt = layer.find("hasPrelu");
            if (hpIt != layer.end()) {
                const auto flag = hpIt->second.as_bool();
                // NOTE: optional<bool> is truthy when ENGAGED, not when true.
                hasPrelu = (flag && *flag) ? 1 : 0;
            }
            if (!getInt("inCh", conv.inCh) || !getInt("outCh", conv.outCh)
                || !getInt("weightOffset", conv.wBase) || !getInt("biasOffset", conv.bBase)) {
                return false;
            }
            conv.hasPrelu = hasPrelu;
            // Slopes arrive as separate prelu entries and are zipped below.
            conv.sBase = -1;
            convs.push_back(conv);
        } else if (kind == "prelu") {
            RawSlope slope;
            if (!getInt("slopeOffset", slope.offset)) return false;
            slopes.push_back(slope);
        } else {
            err = "srvgg manifest has unknown layer kind: " + kind;
            return false;
        }
    }
    if (convs.size() != 18 || slopes.size() != 17) {
        std::ostringstream message;
        message << "srvgg manifest wants " << convs.size() << " convs + " << slopes.size()
                << " slopes; need 18 + 17";
        err = message.str();
        return false;
    }
    for (size_t i = 0; i < 17; i++) {
        if (!convs[i].hasPrelu) {
            err = "srvgg manifest: conv without prelu among the first 17";
            return false;
        }
        convs[i].sBase = slopes[i].offset;
    }
    if (convs[17].hasPrelu) {
        err = "srvgg manifest: last conv must not have prelu";
        return false;
    }
    // Structural pins (same model the gates validate): 3->64, 16x 64->64, 64->48.
    if (convs[0].inCh != 3 || convs[0].outCh != 64 || convs[17].inCh != 64 || convs[17].outCh != 48) {
        err = "srvgg manifest channel geometry mismatch (want 3->64 .. 64->48)";
        return false;
    }
    for (size_t i = 1; i < 17; i++) {
        if (convs[i].inCh != 64 || convs[i].outCh != 64) {
            err = "srvgg manifest body geometry mismatch (want 64->64)";
            return false;
        }
    }
    // Offset bounds: every layer's weights/bias/slopes must lie inside the
    // weight buffer, or the shaders read out of bounds (garbage pixels at
    // best, driver fault at worst). Geometry above pins the channel counts,
    // so the per-layer footprints are exact.
    for (size_t i = 0; i < convs.size(); i++) {
        const long long wFloats = (long long)convs[i].outCh * convs[i].inCh * 9;
        const long long need = (long long)convs[i].wBase + wFloats;
        if (convs[i].wBase < 0 || need > (long long)totalFloats) {
            err = "srvgg manifest weight offset out of range";
            return false;
        }
        if (convs[i].bBase < 0 || (long long)convs[i].bBase + convs[i].outCh > (long long)totalFloats) {
            err = "srvgg manifest bias offset out of range";
            return false;
        }
        if (convs[i].sBase >= 0
            && (long long)convs[i].sBase + convs[i].outCh > (long long)totalFloats) {
            err = "srvgg manifest slope offset out of range";
            return false;
        }
    }

    weightsCpu_ = new ncnn::Mat(static_cast<int>(totalFloats));
    memcpy(weightsCpu_->data, binBytes.data(), binBytes.size());
    layers_ = std::move(convs);
    // NOTE: an oc-contiguous transposed twin ([(ic*9+k)*64+oc]) was tried
    // for coalesced 16-lane reads and measured neutral (L2 covers the
    // strided oc-major reads) — removed again, single shared buffer.
    fprintf(stderr, "[srvgg] weights loaded: %zu floats, %zu layers\n", totalFloats, layers_.size());
    return true;
}

bool SrvggVulkan::createPipelines(std::string& err) {
    if (convPipe_ && tailPipe_) return true;
    // A previous failed attempt can leave exactly one pipeline alive (conv
    // created, tail failed). Recreate both from scratch instead of leaking
    // the old object when this function runs again.
    delete convPipe_;
    convPipe_ = nullptr;
    delete tailPipe_;
    tailPipe_ = nullptr;
    convPipe_ = new ncnn::Pipeline(device_);
    // Explicit 16x16 workgroup like the proven pre/postproc pipes (WITHOUT
    // set_optimal the local size stays 1x1x1: 49k single-thread groups at
    // 256x192, a suspected driver cliff — same geometry the rest uses).
    convPipe_->set_local_size_xyz(16, 16, 1);
    {
        std::vector<ncnn::vk_specialization_type> specs;
        if (convPipe_->create(srvgg_conv_comp_data, sizeof(srvgg_conv_comp_data), specs) != 0) {
            err = "srvgg conv pipeline creation failed";
            delete convPipe_;
            convPipe_ = nullptr;
            return false;
        }
    }
    tailPipe_ = new ncnn::Pipeline(device_);
    tailPipe_->set_local_size_xyz(16, 16, 1);
    {
        std::vector<ncnn::vk_specialization_type> specs;
        if (tailPipe_->create(srvgg_tail_comp_data, sizeof(srvgg_tail_comp_data), specs) != 0) {
            err = "srvgg tail pipeline creation failed";
            delete tailPipe_;
            tailPipe_ = nullptr;
            return false;
        }
    }
    // Tiny dummy for the unbound input slot per dispatch (conv0 reads fp16,
    // body layers read fp32; the idle binding must still be valid).
    dummy_ = new ncnn::VkMat();
    dummy_->create(1, 1, 1, (size_t)4, 1, blob_);
    // Tiled fast path (phase 1b): compile failure must not kill the proven
    // naive path — fall back with a log line.
    tiledPipe_ = new ncnn::Pipeline(device_);
    tiledPipe_->set_local_size_xyz(16, 16, 1);
    {
        std::vector<ncnn::vk_specialization_type> specs;
        if (tiledPipe_->create(srvgg_conv_tiled_comp_data, sizeof(srvgg_conv_tiled_comp_data), specs) != 0) {
            fprintf(stderr, "[srvgg] tiled conv pipeline failed; naive path serves\n");
            delete tiledPipe_;
            tiledPipe_ = nullptr;
            useTiled_ = false;
        }
    }
    fprintf(stderr, "[srvgg] conv+tail pipelines ready (local %ux%ux%u / %ux%ux%u)\n",
            convPipe_->local_size_x(), convPipe_->local_size_y(), convPipe_->local_size_z(),
            tailPipe_->local_size_x(), tailPipe_->local_size_y(), tailPipe_->local_size_z());
    return true;
}

bool SrvggVulkan::run(ncnn::VkCompute& cmd, const ncnn::VkMat& preprocOut, int width, int height,
                      ncnn::VkMat& tailOut, const ncnn::Option& opt, std::string& err) {
    if (!ready_) {
        err = "srvgg backend not ready";
        return false;
    }
    // Weights upload rides the caller's command (in-order with the frame).
    if (!uploadWeights(cmd, opt, err)) return false;
    if (useTiled_ && tiledPipe_) {
        return runTiled(cmd, preprocOut, width, height, tailOut, opt, err);
    }
    // Activation ping-pong (fp32 planar, blob-pooled): 64ch covers conv0..16,
    // conv17 writes 48ch into the same footprint.
    ncnn::VkMat actA;
    actA.create(width, height, 64, (size_t)4, 1, blob_);
    ncnn::VkMat actB;
    actB.create(width, height, 64, (size_t)4, 1, blob_);
    if (!actA.data || !actB.data) {
        err = "srvgg activation alloc failed";
        return false;
    }
    {
        // One-shot geometry log per process: diagnoses allocator-layout
        // cliffs (cstep padding) between frame sizes.
        static bool loggedGeom = false;
        if (!loggedGeom) {
            loggedGeom = true;
            fprintf(stderr,
                    "[srvgg] geom %dx%d act %dx%dx%u cstep=%zu weights %dx%dx%d cstep=%zu preproc cstep=%zu\n",
                    width, height, actA.w, actA.h, (unsigned)actA.c, actA.cstep,
                    weightsGpu_->w, weightsGpu_->h, (unsigned)weightsGpu_->c, weightsGpu_->cstep,
                    preprocOut.cstep);
        }
    }
    const int frameStride = static_cast<int>(preprocOut.cstep);
    const int actStride = static_cast<int>(actA.cstep);
    {
        static bool loggedRun = false;
        if (!loggedRun) {
            loggedRun = true;
            fprintf(stderr,
                    "[srvgg] run %dx%d preproc %dx%dx%u cstep=%zu act cstep=%zu\n",
                    width, height, preprocOut.w, preprocOut.h, (unsigned)preprocOut.c,
                    preprocOut.cstep, (size_t)actStride);
            for (size_t li = 0; li < layers_.size(); li++) {
                const SrvggConvLayer& layer = layers_[li];
                fprintf(stderr,
                        "[srvgg] layer %zu %d->%d wB=%d bB=%d sB=%d prelu=%d\n",
                        li, layer.inCh, layer.outCh, layer.wBase, layer.bBase,
                        layer.sBase, layer.hasPrelu);
            }
        }
    }
    bool flip = false;
    for (size_t li = 0; li < layers_.size(); li++) {
        const SrvggConvLayer& layer = layers_[li];
        const bool first = (li == 0);
        const ncnn::VkMat& inMat = first ? preprocOut : (flip ? actB : actA);
        ncnn::VkMat& outMat = flip ? actA : actB;
        std::vector<ncnn::VkMat> binds(4);
        binds[0] = first ? *dummy_ : inMat;
        binds[1] = *weightsGpu_;
        binds[2] = outMat;
        binds[3] = first ? inMat : *dummy_;
        std::vector<ncnn::vk_constant_type> consts(11);
        consts[0].i = width;
        consts[1].i = height;
        consts[2].i = layer.inCh;
        consts[3].i = layer.outCh;
        consts[4].i = layer.wBase;
        consts[5].i = layer.bBase;
        consts[6].i = layer.sBase;
        consts[7].i = first ? frameStride : actStride;
        consts[8].i = actStride;
        consts[9].i = layer.hasPrelu;
        consts[10].i = first ? 1 : 0;
        ncnn::VkMat disp;
        disp.w = width;
        disp.h = height;
        disp.c = 1;
        cmd.record_pipeline(convPipe_, binds, consts, disp);
        flip = !flip;
    }
    // After 18 layers (even count) flip is false again: conv17 wrote actA.
    const ncnn::VkMat& body48 = flip ? actB : actA;
    // Tail to fp16 planar 4x for the existing postproc shader.
    const int outW = width * 4;
    const int outH = height * 4;
    tailOut.create(outW, outH, 3, (size_t)2, 1, blob_);
    if (!tailOut.data) {
        err = "srvgg tail output alloc failed";
        return false;
    }
    {
        // All four tail bindings must be valid even when bodyIsFp16 selects
        // only one body input: an unbound storage descriptor faults the GPU
        // context (SIGSEGV, no fallback). The dummy is never read here.
        std::vector<ncnn::VkMat> binds(4);
        binds[0] = body48;
        binds[1] = preprocOut;
        binds[2] = tailOut;
        binds[3] = *dummy_;
        std::vector<ncnn::vk_constant_type> consts(6);
        consts[0].i = width;
        consts[1].i = height;
        consts[2].i = actStride;
        consts[3].i = frameStride;
        consts[4].i = static_cast<int>(tailOut.cstep);
        consts[5].i = 0; // bodyIsFp16: naive path reads the fp32 body
        ncnn::VkMat disp;
        disp.w = outW;
        disp.h = outH;
        disp.c = 1;
        cmd.record_pipeline(tailPipe_, binds, consts, disp);
    }
    return true;
}

bool SrvggVulkan::uploadWeights(ncnn::VkCompute& cmd, const ncnn::Option& opt, std::string& err) {
    if (weightsGpu_) return true;
    if (!weightsCpu_ || layers_.empty()) {
        err = "srvgg weights not loaded";
        return false;
    }
    weightsGpu_ = new ncnn::VkMat();
    weightsGpu_->create(static_cast<int>(weightsCpu_->total()), 1, 1, (size_t)4, 1, blob_);
    if (!weightsGpu_->data) {
        err = "srvgg weights GPU alloc failed";
        delete weightsGpu_;
        weightsGpu_ = nullptr;
        return false;
    }
    ncnn::Option topt = opt;
    topt.blob_vkallocator = blob_;
    topt.workspace_vkallocator = blob_;
    topt.staging_vkallocator = staging_;
    cmd.record_clone(*weightsCpu_, *weightsGpu_, topt);
    return true;
}

void SrvggVulkan::invalidateGpuWeights() {
    if (!weightsGpu_) return;
    // Same free pattern as the destructor: the failed submit's command
    // buffer is destroyed with the frame's VkCompute, and the next frame
    // re-records the clone instead of convolving against unwritten memory.
    delete weightsGpu_;
    weightsGpu_ = nullptr;
}

bool SrvggVulkan::runTiled(ncnn::VkCompute& cmd, const ncnn::VkMat& preprocOut, int width, int height,
                           ncnn::VkMat& tailOut, const ncnn::Option& opt, std::string& err) {
    if (!tiledPipe_) {
        err = "srvgg tiled pipeline unavailable";
        return false;
    }
    // Shared weights upload (once per process; idempotent).
    if (!uploadWeights(cmd, opt, err)) return false;
    // fp16 activation ping-pong (uniform: conv0 reads the preproc fp16
    // planar output like every other layer — no first-layer special case).
    ncnn::VkMat actA;
    actA.create(width, height, 64, (size_t)2, 1, blob_);
    ncnn::VkMat actB;
    actB.create(width, height, 64, (size_t)2, 1, blob_);
    if (!actA.data || !actB.data) {
        err = "srvgg tiled activation alloc failed";
        return false;
    }
    const int frameStride = static_cast<int>(preprocOut.cstep);
    const int actStride = static_cast<int>(actA.cstep);
    bool flip = false;
    for (size_t li = 0; li < layers_.size(); li++) {
        const SrvggConvLayer& layer = layers_[li];
        if (layer.outCh % 16 != 0) {
            err = "srvgg tiled path needs outCh divisible by 16";
            return false;
        }
        const ncnn::VkMat& inMat = (li == 0) ? preprocOut : (flip ? actB : actA);
        ncnn::VkMat& outMat = flip ? actA : actB;
        std::vector<ncnn::VkMat> binds(3);
        binds[0] = inMat;
        binds[1] = *weightsGpu_;
        binds[2] = outMat;
        std::vector<ncnn::vk_constant_type> consts(10);
        consts[0].i = width;
        consts[1].i = height;
        consts[2].i = layer.inCh;
        consts[3].i = layer.outCh;
        consts[4].i = layer.wBase; // oc-major bin (shared with naive)
        consts[5].i = layer.bBase;
        consts[6].i = layer.sBase;
        consts[7].i = (li == 0) ? frameStride : actStride;
        consts[8].i = actStride;
        consts[9].i = layer.hasPrelu;
        ncnn::VkMat disp;
        disp.w = width;
        disp.h = height;
        disp.c = layer.outCh / 16;
        cmd.record_pipeline(tiledPipe_, binds, consts, disp);
        flip = !flip;
    }
    // 18 layers (even count): conv17 wrote actA, same parity as run().
    const ncnn::VkMat& body48 = flip ? actB : actA;
    const int outW = width * 4;
    const int outH = height * 4;
    tailOut.create(outW, outH, 3, (size_t)2, 1, blob_);
    if (!tailOut.data) {
        err = "srvgg tiled tail output alloc failed";
        return false;
    }
    {
        std::vector<ncnn::VkMat> binds(4);
        binds[0] = *dummy_;
        binds[1] = preprocOut;
        binds[2] = tailOut;
        binds[3] = body48;
        std::vector<ncnn::vk_constant_type> consts(6);
        consts[0].i = width;
        consts[1].i = height;
        consts[2].i = actStride;
        consts[3].i = frameStride;
        consts[4].i = static_cast<int>(tailOut.cstep);
        consts[5].i = 1; // bodyIsFp16
        ncnn::VkMat disp;
        disp.w = outW;
        disp.h = outH;
        disp.c = 1;
        cmd.record_pipeline(tailPipe_, binds, consts, disp);
    }
    return true;
}
