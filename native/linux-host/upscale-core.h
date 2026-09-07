/*
 * UpscaleCore: the GPU/inference state of the AniWebScale ncnn host,
 * extracted from the former monolithic main() (deep-module refactor).
 *
 * Owns the Vulkan device, the persistent blob/staging allocators, the ncnn
 * Net, the optional hand-written SRVGG backend and the GPU pre/postproc
 * pipelines, plus the shared upscale bookkeeping (exclusive-GPU mutex, idle
 * clock, served-frame counter). The per-frame Vulkan/ncnn logic is moved
 * byte-for-byte out of main()'s run_upscale lambda — moved, not rewritten.
 *
 * Both transports (framed stdin/stdout JSON, loopback HTTP) are thin adapters
 * around this interface. The idle clock is deliberately NOT bumped by
 * run_upscale: each transport reports activity explicitly (the stdin loop on
 * message receipt, the HTTP handler on a successful frame), preserving the
 * original semantics. run_upscale only increments the served-frame counter.
 *
 * Lifecycle:
 *   init_device()  — gpu instance + device selection + report (false = fatal)
 *   load_models()  — ncnn net, custom pipelines, persistent allocators
 *   run_upscale()  — per-frame entry, exclusive GPU ownership via mutex
 *   shutdown()     — reclaim + net.clear + destroy instance (in that order:
 *                    the Net must release GPU resources before the instance
 *                    dies, or the destructor SIGSEGVs in the driver)
 */

#pragma once

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <mutex>
#include <string>
#include <vector>

#include "net.h"
#include "gpu.h"
#if NCNN_VULKAN
#include "pipelinecache.h"
#endif
#include "srvgg-vulkan.h"

#if NCNN_VULKAN
#include "realesrgan_spike_postproc.comp.hex.h"
#include "realesrgan_spike_preproc.comp.hex.h"
#endif

namespace aniwebscale {

// Process configuration for load_models(); filled in by main()'s env/arg
// parsing (CLI concerns stay out of the core).
struct UpscaleCoreConfig {
    bool use_fp16 = true;
    bool use_int8 = false;
    bool use_srvgg_engine = false;
    std::string param_path;
    std::string bin_path;
    std::string int8_param;
    std::string int8_bin;
};

class UpscaleCore {
public:
    UpscaleCore() = default;
    ~UpscaleCore() = default; // shutdown() must run before the instance dies
    UpscaleCore(const UpscaleCore&) = delete;
    UpscaleCore& operator=(const UpscaleCore&) = delete;

    // ncnn gpu instance + device selection + device report. Returns false
    // after logging when no Vulkan device is available (no teardown —
    // mirrors the original early return).
    bool init_device() {
        ncnn::create_gpu_instance();
        device_ = ncnn::get_gpu_device(0);
        if (!device_) {
            fprintf(stderr, "[host] no Vulkan device\n");
            return false;
        }
        report_device(device_);
        // Zombie-Hypothese (2.9.) ist belegter VRAM durch den persistenten
        // Blob-Pool: Budget jetzt loggen, am Idle-Exit nochmal, dann weiß man es.
        heap_budget_start_mb_ = device_->get_heap_budget();
        return true;
    }

    // E6: explicit ncnn pipeline-cache load. The device compiles every
    // layer + custom pipeline on first use; loading the previous session's
    // cache hides that cold-start cost on every later spawn (RADV's disk
    // cache covers shaders, this covers ncnn's pipeline layer: layouts,
    // descriptors, specialization). Best effort, never fatal. Call between
    // init_device() and load_models().
    void load_pipeline_cache(const std::string& path, const std::string& cache_dir) {
        try {
            std::filesystem::create_directories(cache_dir);
#if NCNN_VULKAN
            const ncnn::PipelineCache* pipeline_cache = device_->get_pipeline_cache();
            if (pipeline_cache) {
                FILE* cache_in = fopen(path.c_str(), "rb");
                if (cache_in) {
                    const int rc = pipeline_cache->load_cache(cache_in);
                    fclose(cache_in);
                    fprintf(stderr, "[host] pipeline cache %s: %s (rc=%d)\n",
                            rc == 0 ? "loaded" : "rejected",
                            path.c_str(), rc);
                } else {
                    fprintf(stderr, "[host] no pipeline cache yet: %s\n", path.c_str());
                }
            }
#else
            (void)path;
#endif
        } catch (...) {}
    }

    // ncnn Net + GPU pre/postproc pipelines + persistent allocators. Returns
    // false after logging on any fatal step; the allocator-failure path tears
    // the gpu instance back down (mirrors the original early return).
    bool load_models(const UpscaleCoreConfig& cfg) {
        use_srvgg_engine_ = cfg.use_srvgg_engine;

        net_.opt.use_vulkan_compute = true;
        net_.opt.num_threads = 4;
        net_.opt.use_fp16_packed = cfg.use_fp16;
        net_.opt.use_fp16_storage = cfg.use_fp16;
        net_.opt.use_fp16_arithmetic = false;
        net_.opt.use_winograd_convolution = true;
        net_.opt.use_bf16_storage = false;
        // INT8-Pfad (nur mit quantisiertem Modell, sonst stiller Fallback auf
        // fp32-Layer — deshalb oben fail-fast ohne int8-Dateien).
        net_.opt.use_int8_inference = cfg.use_int8;
        net_.opt.use_int8_storage = cfg.use_int8;
        net_.opt.use_int8_packed = cfg.use_int8;
        net_.opt.use_int8_arithmetic = cfg.use_int8;

        const std::string& load_param = cfg.use_int8 ? cfg.int8_param : cfg.param_path;
        const std::string& load_bin = cfg.use_int8 ? cfg.int8_bin : cfg.bin_path;
        if (net_.load_param(load_param.c_str()) != 0) {
            fprintf(stderr, "[host] failed to load param %s\n", load_param.c_str());
            return false;
        }
        if (net_.load_model(load_bin.c_str()) != 0) {
            fprintf(stderr, "[host] failed to load bin %s\n", load_bin.c_str());
            return false;
        }
        fprintf(stderr, "[host] model loaded\n");

#if NCNN_VULKAN
        if (cfg.use_fp16) {
            postproc_ = new ncnn::Pipeline(device_);
            postproc_->set_optimal_local_size_xyz(32, 32, 1);
            std::vector<ncnn::vk_specialization_type> specs(1);
            specs[0].i = 0;
            if (postproc_->create(realesrgan_spike_postproc_comp_data, sizeof(realesrgan_spike_postproc_comp_data), specs) != 0) {
                fprintf(stderr, "[host] failed to create postproc pipeline\n");
                delete postproc_;
                postproc_ = nullptr;
            } else {
                fprintf(stderr, "[host] GPU postproc ready\n");
            }
            // Preproc: RGBA8 -> planar fp16, avoids CPU loop + CPU cast
            preproc_ = new ncnn::Pipeline(device_);
            preproc_->set_optimal_local_size_xyz(32, 32, 1);
            std::vector<ncnn::vk_specialization_type> pre_specs(1);
            pre_specs[0].i = 0;
            if (preproc_->create(realesrgan_spike_preproc_comp_data, sizeof(realesrgan_spike_preproc_comp_data), pre_specs) != 0) {
                fprintf(stderr, "[host] failed to create preproc pipeline\n");
                delete preproc_;
                preproc_ = nullptr;
            } else {
                fprintf(stderr, "[host] GPU preproc ready\n");
            }
        }
#endif

        // E4 phase 1: srvgg backend is fully lazy (zero cost when unused or
        // disabled): created on the first E4 frame, weights + pipelines then.
        srvgg_models_dir_ =
            std::filesystem::path(cfg.bin_path).parent_path().parent_path().string();
        if (cfg.use_srvgg_engine) {
            fprintf(stderr, "[srvgg] engine enabled (env ANIWEBSCALE_SRVGG_ENGINE), models dir %s\n",
                    srvgg_models_dir_.c_str());
        }

        // Persistent Vulkan allocators — acquired once, reused for every frame.
        // Avoids per-frame vkAllocate churn and mirrors benchmark S2 change.
        blob_ = device_->acquire_blob_allocator();
        staging_ = device_->acquire_staging_allocator();
        if (!blob_ || !staging_) {
            fprintf(stderr, "[host] failed to acquire Vulkan allocators\n");
            if (blob_) device_->reclaim_blob_allocator(blob_);
            if (staging_) device_->reclaim_staging_allocator(staging_);
            blob_ = nullptr;
            staging_ = nullptr;
#if NCNN_VULKAN
            delete postproc_;
            postproc_ = nullptr;
            delete preproc_;
            preproc_ = nullptr;
#endif
            // Same ordering rule as shutdown(): the Net must release its GPU
            // resources BEFORE the instance dies, or ~Net() SIGSEGVs later in
            // the driver. (Latent since HEAD — the failure path skipped it.)
            net_.clear();
            ncnn::destroy_gpu_instance();
            device_ = nullptr;
            return false;
        }
        fprintf(stderr, "[host] persistent allocators ready (blob=%p staging=%p)\n", (void*)blob_, (void*)staging_);
        return true;
    }

    // Per-frame entry (p7): single-pass for small frames, tiled (640/32)
    // above 1280x720, GPU pre/post-processing, latest-wins quality identical
    // between transports. The mutex gives exclusive GPU ownership to exactly
    // one upscale at a time across both transports.
    // p8: optional tw/th presentation target — when the client knows the
    // canvas/display size, the postproc shader box-averages the network
    // output down to that size BEFORE the download, so the transported
    // payload shrinks from the full 4x frame (up to 59 MB at 720p input)
    // toward the display size (8–16 MB typically). The adaptive presentation
    // sampler already area-averages on the GPU; this moves the same math in
    // front of the transport, which is the expensive part.
    bool run_upscale(const unsigned char* rgba, int width, int height,
                     int target_w, int target_h,
                     std::vector<unsigned char>& out, int& out_w, int& out_h,
                     std::string& err_msg, const std::string& engine = "") {
        std::lock_guard<std::mutex> lock(upscale_mutex_);
        const bool ok = run_upscale_impl(rgba, width, height, target_w, target_h,
                                         out, out_w, out_h, err_msg, engine);
        if (ok) frames_served_.fetch_add(1, std::memory_order_relaxed);
        return ok;
    }

    // E6: persist the device pipeline cache for the next cold start. The
    // caller runs this after the transports stop (GPU idle, every pipeline
    // compiled) and before shutdown() (the cache dies with the device).
    void save_pipeline_cache(const std::string& path) {
#if NCNN_VULKAN
        const ncnn::PipelineCache* pipeline_cache = device_->get_pipeline_cache();
        if (pipeline_cache) {
            FILE* cache_out = fopen(path.c_str(), "wb");
            if (cache_out) {
                const int rc = pipeline_cache->save_cache(cache_out);
                fclose(cache_out);
                fprintf(stderr, "[host] pipeline cache saved: %s (rc=%d)\n",
                        path.c_str(), rc);
            } else {
                fprintf(stderr, "[host] pipeline cache save failed: %s\n", path.c_str());
            }
        }
#else
        (void)path;
#endif
    }

    void shutdown() {
        if (blob_) { device_->reclaim_blob_allocator(blob_); blob_ = nullptr; }
        if (staging_) { device_->reclaim_staging_allocator(staging_); staging_ = nullptr; }
#if NCNN_VULKAN
        delete srvgg_;
        srvgg_ = nullptr;
        delete postproc_;
        postproc_ = nullptr;
        delete preproc_;
        preproc_ = nullptr;
#endif
        // Lifetime rule from the spike: the Net must release its GPU resources
        // BEFORE the instance dies. net.clear() destroys the layers now, while
        // the instance is still alive; the empty Net destructor afterwards is
        // a no-op.
        net_.clear();
        ncnn::destroy_gpu_instance();
        device_ = nullptr;
    }

    // Idle-Reaper-Uhr: beide Transporte (stdin-framed + HTTP-Loopback) melden
    // Aktivität; der HTTP-Pfad läuft auf einem eigenen Thread, daher atomar.
    // Millisekunden seit einem beliebigen steady_clock-Nullpunkt, nur für
    // Differenzen benutzt.
    static uint64_t now_ms() {
        return (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
    }
    void note_activity() { last_activity_ms_.store(now_ms(), std::memory_order_relaxed); }
    uint64_t idle_ms() const { return now_ms() - last_activity_ms_.load(std::memory_order_relaxed); }
    uint64_t frames_served() const { return frames_served_.load(std::memory_order_relaxed); }

    // Accessors for the process-level concerns that stay in main(): the
    // --traffic-test probe and the pipeline-cache persistence helpers.
    ncnn::VulkanDevice* device() const { return device_; }
    ncnn::VkAllocator* blob_allocator() const { return blob_; }
    ncnn::VkAllocator* staging_allocator() const { return staging_; }
    uint32_t heap_budget_start_mb() const { return heap_budget_start_mb_; }

private:
    static void report_device(const ncnn::VulkanDevice* dev) {
        const auto& info = dev->info;
        fprintf(stderr, "[host] device=%s api=%u.%u.%u driver=%s fp16_packed=%d fp16_storage=%d fp16_arith=%d rebar=%d\n",
            info.device_name(),
            info.api_version() >> 22, (info.api_version() >> 12) & 0x3ff, info.api_version() & 0xfff,
            info.driver_name(),
            info.support_fp16_packed(), info.support_fp16_storage(), info.support_fp16_arithmetic(),
            info.resizable_bar_enabled());
    }

    // Body of the former run_upscale lambda, moved verbatim (local variables
    // became members). Caller must hold upscale_mutex_.
    bool run_upscale_impl(const unsigned char* rgba, int width, int height,
                          int target_w, int target_h,
                          std::vector<unsigned char>& out, int& out_w, int& out_h,
                          std::string& err_msg, const std::string& engine) {
#if NCNN_VULKAN
        const long long px = (long long)width * height;
        const bool tiled = px > (long long)1280 * 720;
        // E4 selection: explicit per-request engine wins; otherwise the
        // process env default applies (probes + back-compat). Unknown values
        // fall back to ncnn.
        const bool wantSrvgg = !engine.empty() ? (engine == "srvgg") : use_srvgg_engine_;
        ncnn::Option opt = net_.opt;
        opt.blob_vkallocator = blob_;
        opt.workspace_vkallocator = blob_;
        opt.staging_vkallocator = staging_;

        auto run_gpu_frame = [&](const unsigned char* rgba_src, int iw, int ih,
                                 int fw, int fh, // postproc target for THIS tile/frame
                                 std::vector<unsigned char>& frame_out, int& ow, int& oh,
                                 std::string& emsg, bool allowSrvgg) -> bool {
            // Spike lifetime rule: ONE VkCompute per inference, destroyed with
            // the frame's VkMats before the allocators are touched again.
            // Reusing a long-lived VkCompute across several submit_and_wait()
            // cycles (the tiled path) reliably SIGSEGVs inside RADV on the
            // second tile's submit — the command buffer scratch space is
            // recycled while the driver still references the previous
            // submission. The single-pass path used to share the persistent
            // frame_cmd from p3; per-frame is the only pattern that has ever
            // been validated with tiles, so use it everywhere.
            ncnn::VkCompute cmd(device_);
            ncnn::Option topt = opt;
            ncnn::Mat tile_rgba_cpu(iw, ih, (size_t)4, 1u);
            memcpy(tile_rgba_cpu.data, rgba_src, (size_t)iw*ih*4);
            ncnn::VkMat rgba_gpu;
            rgba_gpu.create(iw, ih, (size_t)4, 1, blob_);
            cmd.record_clone(tile_rgba_cpu, rgba_gpu, topt);
            ncnn::VkMat in_gpu_pre;
            in_gpu_pre.create(iw, ih, 3, (size_t)2, 1, blob_);
            {
                std::vector<ncnn::VkMat> binds(2);
                binds[0] = rgba_gpu;
                binds[1] = in_gpu_pre;
                std::vector<ncnn::vk_constant_type> consts(3);
                consts[0].i = iw;
                consts[1].i = ih;
                consts[2].i = (int)in_gpu_pre.cstep; // real padded cstep from the blob
                ncnn::VkMat disp; disp.w = iw; disp.h = ih; disp.c = 1;
                cmd.record_pipeline(preproc_, binds, consts, disp);
            }
            ncnn::VkMat out_gpu;
            // E4 phase 1: hand-written SRVGG kernels instead of the ncnn
            // extractor (full frames only; tiles and any srvgg failure fall
            // back to ncnn for the same frame). Postproc/download below are
            // shared: tailOut is fp16 planar exactly like extractor output.
            bool srvggServed = false;
            if (allowSrvgg && wantSrvgg) {
                if (!srvgg_) srvgg_ = new SrvggVulkan(device_, blob_, staging_);
                std::string srvggErr;
                if (srvgg_->ensure(srvgg_models_dir_, srvggErr)
                    && srvgg_->run(cmd, in_gpu_pre, iw, ih, out_gpu, topt, srvggErr)) {
                    srvggServed = true;
                    static bool loggedSrvgg = false;
                    if (!loggedSrvgg) {
                        loggedSrvgg = true;
                        fprintf(stderr, "[srvgg] serving frames (ncnn fallback armed)\n");
                    }
                } else {
                    fprintf(stderr, "[srvgg] frame falls back to ncnn: %s\n", srvggErr.c_str());
                }
            }
            if (!srvggServed) {
                ncnn::Extractor ex = net_.create_extractor();
                ex.set_blob_vkallocator(blob_);
                ex.set_workspace_vkallocator(blob_);
                ex.set_staging_vkallocator(staging_);
                ex.input("data", in_gpu_pre);
                int ret = ex.extract("output", out_gpu, cmd);
                if (ret != 0) { emsg = "extractor extract failed"; return false; }
            }
            if (!postproc_) { emsg = "gpu postproc pipeline unavailable"; return false; }
            // Clamp the presentation target to the network output; the shader
            // falls back to identity taps on any axis it does not shrink.
            const int pw = std::min(fw > 0 ? fw : out_gpu.w, out_gpu.w);
            const int ph = std::min(fh > 0 ? fh : out_gpu.h, out_gpu.h);
            ncnn::VkMat out_rgba_gpu;
            out_rgba_gpu.create(pw, ph, (size_t)4, 1, blob_);
            {
                std::vector<ncnn::VkMat> binds(2);
                binds[0] = out_gpu;
                binds[1] = out_rgba_gpu;
                std::vector<ncnn::vk_constant_type> consts(5);
                consts[0].i = out_gpu.w;
                consts[1].i = out_gpu.h;
                consts[2].i = out_gpu.cstep;
                consts[3].i = pw;
                consts[4].i = ph;
                ncnn::VkMat disp; disp.w = pw; disp.h = ph; disp.c = 1;
                cmd.record_pipeline(postproc_, binds, consts, disp);
            }
            ncnn::Mat dst;
            cmd.record_clone(out_rgba_gpu, dst, topt);
            // Never ignore the submit result: a dead submit leaves every
            // buffer untouched (silent black frame with even alpha 0) while
            // the HTTP layer reports success. Fail loudly so the client
            // retries or falls back instead of presenting black. When srvgg
            // served this frame, re-arm its weight upload: the latch is set
            // when the clone is recorded, and this submit (carrying it)
            // failed — the next frame must re-transfer the weights.
            if (cmd.submit_and_wait() != 0) {
                if (srvggServed) srvgg_->invalidateGpuWeights();
                emsg = "gpu submit failed";
                return false;
            }
            ow = dst.w; oh = dst.h;
            size_t need = (size_t)ow*oh*4;
            if (need != (size_t)dst.w*dst.h*4) { emsg = "gpu postproc size mismatch"; return false; }
            frame_out.resize(need);
            memcpy(frame_out.data(), dst.data, need);
            return true;
        };

        if (!tiled) {
            return run_gpu_frame(rgba, width, height, target_w, target_h, out, out_w, out_h, err_msg, true);
        }
        // Tile in input pixels. PAD covers model prepadding (10) + conv margin.
        // Hebel 1.2: TILE 640 (was 512) — fewer submits and fewer PAD-halo
        // recomputes per frame on VRAM that fits it easily; PAD is a model
        // property and stays 32.
        const int TILE = 640, PAD = 32, scale = 4;
        // Tiling DESIGN NOTE — this host tiles with a recompute-halo scheme
        // (PAD-halo around each tile, core-region copy, NO feathering), while
        // the ORT worker tiles with overlap + weighted feathering
        // (src/shared/realesrgan-tile-geometry.js, TILE 384/512 + 24). The
        // divergence is deliberate, not drift: ncnn's tiled spike is a
        // recompute-halo design from a different execution model, and the two
        // paths never had to agree pixel-for-pixel. Do not "unify" them
        // without an E2E gate on both engines.
        // Tiled path: when a presentation target is given, first compose the
        // full 4x frame (bit-identical to the untargeted path), then do ONE
        // box-average pass over the composed bytes on the CPU. Composing on
        // the GPU per tile and stitching the downscaled tiles would save more
        // bandwidth, but the seam math (each output pixel can straddle tiles)
        // makes it easy to get wrong; the CPU box pass is exact and the tiled
        // path is the >720p exception, not the hot path.
        out_w = width * scale; out_h = height * scale;
        const bool downscale = target_w > 0 && target_h > 0
            && (target_w < out_w || target_h < out_h);
        const int comp_w = out_w, comp_h = out_h; // compose size
        out.assign((size_t)out_w * out_h * 4, 0);
        for (int ty = 0; ty < height; ty += TILE) {
            for (int tx = 0; tx < width; tx += TILE) {
                int cx0 = tx, cy0 = ty;
                int cx1 = std::min(tx + TILE, width), cy1 = std::min(ty + TILE, height);
                int ex0 = std::max(0, cx0 - PAD), ey0 = std::max(0, cy0 - PAD);
                int ex1 = std::min(width, cx1 + PAD), ey1 = std::min(height, cy1 + PAD);
                int ew = ex1 - ex0, eh = ey1 - ey0;
                std::vector<unsigned char> tile((size_t)ew * eh * 4);
                for (int y = 0; y < eh; ++y) {
                    memcpy(tile.data() + (size_t)y * ew * 4,
                           rgba + ((size_t)(ey0 + y) * width + ex0) * 4,
                           (size_t)ew * 4);
                }
                std::vector<unsigned char> tout;
                int tw = 0, th = 0;
                std::string terr;
                if (!run_gpu_frame(tile.data(), ew, eh, 0, 0, tout, tw, th, terr, false)) {
                    err_msg = terr.empty() ? "tile failed" : terr;
                    return false;
                }
                // Copy core region: core input (cx0..cx1)x(cy0..cy1) → output*4
                int owx0 = (cx0 - ex0) * scale, owy0 = (cy0 - ey0) * scale;
                int core_w = (cx1 - cx0) * scale, core_h = (cy1 - cy0) * scale;
                int ox = cx0 * scale, oy = cy0 * scale;
                for (int y = 0; y < core_h; ++y) {
                    memcpy(out.data() + (((size_t)(oy + y) * out_w) + ox) * 4,
                           tout.data() + ((size_t)(owy0 + y) * tw + owx0) * 4,
                           (size_t)core_w * 4);
                }
            }
        }
        if (downscale) {
            // Exact box average, same weights as the shader (fractional edges).
            const int nw = std::min(target_w, comp_w);
            const int nh = std::min(target_h, comp_h);
            std::vector<unsigned char> small((size_t)nw * nh * 4);
            for (int y = 0; y < nh; ++y) {
                const float y0f = (float)y * comp_h / nh;
                const float y1f = (float)(y + 1) * comp_h / nh;
                const int y0 = (int)floorf(y0f), y1 = (int)ceilf(y1f);
                for (int x = 0; x < nw; ++x) {
                    const float x0f = (float)x * comp_w / nw;
                    const float x1f = (float)(x + 1) * comp_w / nw;
                    const int x0 = (int)floorf(x0f), x1 = (int)ceilf(x1f);
                    float ar = 0, ag = 0, ab = 0, wsum = 0;
                    for (int sy = y0; sy < y1; ++sy) {
                        const float wy = std::min(y1f, (float)sy + 1) - std::max(y0f, (float)sy);
                        if (wy <= 0) continue;
                        for (int sx = x0; sx < x1; ++sx) {
                            const float wx = std::min(x1f, (float)sx + 1) - std::max(x0f, (float)sx);
                            if (wx <= 0) continue;
                            const float wgt = wx * wy;
                            const unsigned char* px4 = out.data() + (((size_t)sy * comp_w) + sx) * 4;
                            ar += px4[0] * wgt; ag += px4[1] * wgt; ab += px4[2] * wgt;
                            wsum += wgt;
                        }
                    }
                    const float inv = 1.0f / std::max(wsum, 1e-6f);
                    unsigned char* d = small.data() + (((size_t)y * nw) + x) * 4;
                    d[0] = (unsigned char)std::min(255.0f, floorf(ar * inv + 0.5f));
                    d[1] = (unsigned char)std::min(255.0f, floorf(ag * inv + 0.5f));
                    d[2] = (unsigned char)std::min(255.0f, floorf(ab * inv + 0.5f));
                    d[3] = 255;
                }
            }
            out.swap(small);
            out_w = nw; out_h = nh;
        }
        return true;
#else
        (void)rgba; (void)width; (void)height; (void)out; (void)out_w; (void)out_h;
        err_msg = "built without Vulkan support";
        return false;
#endif
    }

    ncnn::VulkanDevice* device_ = nullptr;
    ncnn::Net net_;
    ncnn::VkAllocator* blob_ = nullptr;
    ncnn::VkAllocator* staging_ = nullptr;
#if NCNN_VULKAN
    ncnn::Pipeline* postproc_ = nullptr;
    ncnn::Pipeline* preproc_ = nullptr;
#endif
    SrvggVulkan* srvgg_ = nullptr; // lazy, created on the first E4 frame
    std::string srvgg_models_dir_;
    bool use_srvgg_engine_ = false;

    std::mutex upscale_mutex_;
    std::atomic<uint64_t> last_activity_ms_{now_ms()};
    std::atomic<uint64_t> frames_served_{0};
    uint32_t heap_budget_start_mb_ = 0;
};

} // namespace aniwebscale
