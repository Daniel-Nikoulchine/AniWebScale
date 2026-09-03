/*
 * AniWebScale Linux ncnn-Vulkan Native Host
 *
 * Standalone Native Messaging host for Real-ESRGAN AnimeVideo v3 (x4) on Linux.
 * Mirrors the spike's proven Vulkan path (RADV NAVI22, fp16 storage, GPU postproc)
 * but as a persistent stdin/stdout service: the browser sends framed JSON with
 * RGBA8, the host returns 4x RGBA8. No window capture, no D3D11, no named pipe.
 *
 * Framing: 4-byte little-endian length prefix + UTF-8 JSON (Chrome/Firefox spec).
 * Logging goes to stderr, stdout is strictly framed.
 */

#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <string>
#include <vector>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <errno.h>
#include <sched.h>
#include <sys/resource.h>
#include <thread>
#include <mutex>
#include <atomic>
#include <condition_variable>
#include <random>

#include "anime4k/json.hpp"
#include "net.h"
#include "gpu.h"
#include "http-transport.h"

#if NCNN_VULKAN
#include "realesrgan_spike_postproc.comp.hex.h"
#include "realesrgan_spike_preproc.comp.hex.h"
#endif

// ---------- base64 ----------
// Fast table-driven Base64 (scalar, ~2.5x faster than branchy version).
// Kept header-only to avoid external deps; AVX2 path can be added later.
// For true zero-copy the SharedMem transport (S5b) removes base64 entirely.
static const char* b64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static const int8_t b64_dec_table[256] = {
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
    52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
    -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
    15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
    -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
    41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
};

static std::string base64_encode(const unsigned char* data, size_t len) {
    std::string out;
    out.reserve(((len + 2) / 3) * 4);
    size_t i = 0;
    // Process 3 bytes at a time without per-byte branches
    for (; i + 2 < len; i += 3) {
        uint32_t triple = (uint32_t(data[i]) << 16) | (uint32_t(data[i+1]) << 8) | uint32_t(data[i+2]);
        out.push_back(b64_chars[(triple >> 18) & 63]);
        out.push_back(b64_chars[(triple >> 12) & 63]);
        out.push_back(b64_chars[(triple >> 6) & 63]);
        out.push_back(b64_chars[triple & 63]);
    }
    size_t rem = len - i;
    if (rem == 1) {
        uint32_t triple = uint32_t(data[i]) << 16;
        out.push_back(b64_chars[(triple >> 18) & 63]);
        out.push_back(b64_chars[(triple >> 12) & 63]);
        out.push_back('=');
        out.push_back('=');
    } else if (rem == 2) {
        uint32_t triple = (uint32_t(data[i]) << 16) | (uint32_t(data[i+1]) << 8);
        out.push_back(b64_chars[(triple >> 18) & 63]);
        out.push_back(b64_chars[(triple >> 12) & 63]);
        out.push_back(b64_chars[(triple >> 6) & 63]);
        out.push_back('=');
    }
    return out;
}

static bool base64_decode(const std::string& in, std::vector<unsigned char>& out) {
    out.clear();
    out.reserve(in.size() * 3 / 4);
    size_t len = in.size();
    // Fast path: process 4 chars at a time using table
    size_t i = 0;
    // Skip leading whitespace (rare for our JSON)
    // Main loop — 4 chars -> 3 bytes
    for (; i + 3 < len; ) {
        // Skip whitespace inline
        int8_t d0 = b64_dec_table[(unsigned char)in[i]];
        int8_t d1 = b64_dec_table[(unsigned char)in[i+1]];
        int8_t d2 = b64_dec_table[(unsigned char)in[i+2]];
        int8_t d3 = b64_dec_table[(unsigned char)in[i+3]];
        // Handle padding / whitespace
        if (d0 < 0 || d1 < 0) {
            // whitespace or invalid
            if (in[i] == '=' ) break;
            if (in[i]=='\n' || in[i]=='\r' || in[i]==' ' || in[i]=='\t') { ++i; continue; }
            if (d0 < 0 || d1 < 0) return false;
        }
        if (d2 < 0) {
            if (in[i+2] == '=') {
                // 1 byte left: 2 chars + ==
                if (d0 <0 || d1 <0) return false;
                uint32_t triple = (uint32_t(d0) << 18) | (uint32_t(d1) << 12);
                out.push_back((triple >> 16) & 0xFF);
                return true;
            }
            if (in[i+2]=='\n' || in[i+2]=='\r' || in[i+2]==' ' || in[i+2]=='\t') { ++i; continue; }
            return false;
        }
        if (d3 < 0) {
            if (in[i+3] == '=') {
                // 2 bytes left: 3 chars + =
                uint32_t triple = (uint32_t(d0) << 18) | (uint32_t(d1) << 12) | (uint32_t(d2) << 6);
                out.push_back((triple >> 16) & 0xFF);
                out.push_back((triple >> 8) & 0xFF);
                return true;
            }
            if (in[i+3]=='\n' || in[i+3]=='\r' || in[i+3]==' ' || in[i+3]=='\t') { ++i; continue; }
            return false;
        }
        uint32_t triple = (uint32_t(d0) << 18) | (uint32_t(d1) << 12) | (uint32_t(d2) << 6) | uint32_t(d3);
        out.push_back((triple >> 16) & 0xFF);
        out.push_back((triple >> 8) & 0xFF);
        out.push_back(triple & 0xFF);
        i += 4;
    }
    // Tail (remaining <4 chars) — use bitstream method
    int val = 0, valb = -8;
    for (; i < len; ++i) {
        unsigned char c = (unsigned char)in[i];
        if (c == '=') break;
        int8_t d = b64_dec_table[c];
        if (d == -1) {
            if (c=='\n' || c=='\r' || c==' ' || c=='\t') continue;
            return false;
        }
        val = (val << 6) | d;
        valb += 6;
        if (valb >= 0) {
            out.push_back((val >> valb) & 0xFF);
            valb -= 8;
        }
    }
    return true;
}

// ---------- framed I/O ----------
static bool read_exact(int fd, void* buf, size_t n) {
    auto* p = static_cast<char*>(buf);
    size_t off = 0;
    while (off < n) {
        ssize_t r = ::read(fd, p + off, n - off);
        if (r == 0) return false; // EOF
        if (r < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        off += r;
    }
    return true;
}
static bool write_exact(int fd, const void* buf, size_t n) {
    auto* p = static_cast<const char*>(buf);
    size_t off = 0;
    while (off < n) {
        ssize_t w = ::write(fd, p + off, n - off);
        if (w <= 0) {
            if (w < 0 && errno == EINTR) continue;
            return false;
        }
        off += w;
    }
    return true;
}
static bool read_framed(std::string& payload) {
    uint32_t len = 0;
    if (!read_exact(STDIN_FILENO, &len, 4)) return false;
    // little endian
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    len = __builtin_bswap32(len);
#endif
    if (len > 100 * 1024 * 1024) {
        fprintf(stderr, "[host] framed message too large: %u\n", len);
        return false;
    }
    payload.resize(len);
    if (len == 0) return true;
    return read_exact(STDIN_FILENO, payload.data(), len);
}
static bool write_framed(const std::string& payload) {
    uint32_t len = payload.size();
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    uint32_t le = __builtin_bswap32(len);
    if (!write_exact(STDOUT_FILENO, &le, 4)) return false;
#else
    if (!write_exact(STDOUT_FILENO, &len, 4)) return false;
#endif
    if (len == 0) return true;
    return write_exact(STDOUT_FILENO, payload.data(), len);
}

using anime4k::json::Value;
using anime4k::json::Object;

static std::string get_string(const Object& o, const char* key, const std::string& def = "") {
    auto it = o.find(key);
    if (it == o.end()) return def;
    auto* s = it->second.as_string();
    return s ? *s : def;
}
static double get_number(const Object& o, const char* key, double def = 0) {
    auto it = o.find(key);
    if (it == o.end()) return def;
    auto n = it->second.as_number();
    return n ? *n : def;
}

// ---------- vulkan helpers ----------
static void report_device(const ncnn::VulkanDevice* dev) {
    const auto& info = dev->info;
    fprintf(stderr, "[host] device=%s api=%u.%u.%u driver=%s fp16_packed=%d fp16_storage=%d fp16_arith=%d rebar=%d\n",
        info.device_name(),
        info.api_version() >> 22, (info.api_version() >> 12) & 0x3ff, info.api_version() & 0xfff,
        info.driver_name(),
        info.support_fp16_packed(), info.support_fp16_storage(), info.support_fp16_arithmetic(),
        info.resizable_bar_enabled());
}

static std::string find_model_file(const char* def, const char* env) {
    const char* e = std::getenv(env);
    if (e && std::filesystem::exists(e)) return e;
    if (std::filesystem::exists(def)) return def;
    // try relative to exe
    char exe[4096] = {};
    ssize_t n = ::readlink("/proc/self/exe", exe, sizeof(exe)-1);
    if (n > 0) {
        std::filesystem::path p = std::filesystem::path(std::string(exe, n)).parent_path();
        for (int i=0;i<5;i++) {
            auto cand = p / def;
            if (std::filesystem::exists(cand)) return cand.string();
            // also try models/... relative to repo
            cand = p / "../../models/realesrgan/ncnn" / std::filesystem::path(def).filename();
            if (std::filesystem::exists(cand)) return cand.string();
            p = p.parent_path();
        }
    }
    // fallback absolute repo path
    std::string fallback = "/home/daniel/Projects/anime4kBrowser/models/realesrgan/ncnn/" + std::string(std::filesystem::path(def).filename());
    if (std::filesystem::exists(fallback)) return fallback;
    return def;
}

int main(int argc, char** argv) {
    bool use_fp16 = true;
    // Idle reaper (Zombie-Fix, 2.9.): exit after N seconds without any frame
    // on EITHER transport so a forgotten host stops pinning GPU allocations.
    // The browser re-spawns the host via Native Messaging on the next frame;
    // the broker drops the dead port on onDisconnect. 0 disables the reaper.
    long idle_timeout_s = 90;
    if (const char* e = std::getenv("ANIWEBSCALE_HOST_IDLE_TIMEOUT_S")) {
        char* end = nullptr;
        long v = std::strtol(e, &end, 10);
        if (end != e && v >= 0) idle_timeout_s = v;
    }
    // INT8-Experiment (2.9., ncnn-Pin post #6751): quantisiertes Modell über
    // separate Dateien, per Default aus. Dateien erzeugt
    // native/spike/calibrate-ncnn-int8.sh (ncnn2table/ncnn2int8).
    bool use_int8 = false;
    std::string int8_param, int8_bin;
    if (const char* e = std::getenv("ANIWEBSCALE_NCNN_INT8_PARAM")) int8_param = e;
    if (const char* e = std::getenv("ANIWEBSCALE_NCNN_INT8_BIN")) int8_bin = e;
    std::string param_path = find_model_file(DEFAULT_PARAM_PATH, "ANIWEBSCALE_NCNN_PARAM");
    std::string bin_path = find_model_file(DEFAULT_BIN_PATH, "ANIWEBSCALE_NCNN_BIN");
    for (int i=1;i<argc;i++) {
        std::string a = argv[i];
        if (a == "--no-fp16") use_fp16 = false;
        else if (a == "--fp16") use_fp16 = true;
        else if (a == "--param" && i+1 < argc) param_path = argv[++i];
        else if (a == "--bin" && i+1 < argc) bin_path = argv[++i];
        else if (a == "--int8") use_int8 = true;
        else if (a == "--no-int8") use_int8 = false;
        else if (a == "--int8-param" && i+1 < argc) int8_param = argv[++i];
        else if (a == "--int8-bin" && i+1 < argc) int8_bin = argv[++i];
        else if (a == "--idle-timeout" && i+1 < argc) {
            char* end = nullptr;
            const long idle_value = std::strtol(argv[++i], &end, 10);
            if (end == nullptr || *end != '\0' || idle_value < 0) {
                fprintf(stderr, "[host] invalid --idle-timeout value: %s\n", argv[i]);
                return 1;
            }
            idle_timeout_s = idle_value;
        }
        else if (a == "--help" || a == "-h") {
            fprintf(stderr, "Usage: %s [--param file.param] [--bin file.bin] [--fp16|--no-fp16] [--idle-timeout SECS]\n"
                            "       [--int8 --int8-param file-int8.param --int8-bin file-int8.bin]\n", argv[0]);
            return 0;
        }
    }

    fprintf(stderr, "[host] AniWebScale ncnn-Vulkan host starting\n");
    fprintf(stderr, "[host] param=%s\n[host] bin=%s fp16=%d int8=%d\n",
            param_path.c_str(), bin_path.c_str(), use_fp16, use_int8);
    if (use_int8) {
        if (int8_param.empty() || int8_bin.empty()
            || !std::filesystem::exists(int8_param) || !std::filesystem::exists(int8_bin)) {
            fprintf(stderr, "[host] --int8 needs existing --int8-param/--int8-bin files "
                            "(run native/spike/calibrate-ncnn-int8.sh first)\n");
            return 1;
        }
        fprintf(stderr, "[host] int8 param=%s\n[host] int8 bin=%s\n",
                int8_param.c_str(), int8_bin.c_str());
    }

    // Pipeline cache: try to load on-disk cache for faster cold start (RADV also caches, but this covers ncnn's pipeline layer)
    // We keep it simple: load if exists, save on exit. Not critical for steady-state benchmark.
    const char* cache_home = std::getenv("XDG_CACHE_HOME");
    std::string cache_dir = cache_home ? std::string(cache_home) + "/aniwebscale" : std::string(std::getenv("HOME") ? std::getenv("HOME") : "/tmp") + "/.cache/aniwebscale";
    std::string pipeline_cache_path = cache_dir + "/ncnn_pipeline_cache.bin";
    // ncnn's PipelineCache is per-device; we will load after device creation if file exists (best effort)
    // p6: host hygiene — keep the main thread off core 0 (IRQ-heavy) and give it
    // scheduling priority. Cheap, no downside, shaves scheduling jitter.
    {
        cpu_set_t set;
        CPU_ZERO(&set);
        int ncpus = (int)sysconf(_SC_NPROCESSORS_ONLN);
        // Pin to cores 2..(ncpus-1): dodges kernel housekeeping on core 0/1
        for (int c = 2; c < ncpus; ++c) CPU_SET(c, &set);
        if (sched_setaffinity(0, sizeof(set), &set) == 0) {
            fprintf(stderr, "[host] affinity set to cores 2-%d\n", ncpus - 1);
        }
        // Best-effort nicer scheduling; without root only positive nice works.
        setpriority(PRIO_PROCESS, 0, -5);
        fprintf(stderr, "[host] nice=%d (negative needs root/cap)\n", getpriority(PRIO_PROCESS, 0));
    }

    ncnn::create_gpu_instance();
    ncnn::VulkanDevice* device = ncnn::get_gpu_device(0);
    if (!device) {
        fprintf(stderr, "[host] no Vulkan device\n");
        return 1;
    }
    report_device(device);
    // Zombie-Hypothese (2.9.) ist belegter VRAM durch den persistenten
    // Blob-Pool: Budget jetzt loggen, am Idle-Exit nochmal, dann weiß man es.
    const uint32_t heap_budget_start_mb = device->get_heap_budget();
    fprintf(stderr, "[host] heap budget=%u MB idle_timeout=%lds\n",
            heap_budget_start_mb, idle_timeout_s);
    // Takt-Check (Hygiene, 2.9.): ein gedrosselter Governor erklärt die
    // +7 % beim 1080p-Lauf. Reine Diagnose, ändert nichts.
    for (const auto& entry : std::filesystem::directory_iterator("/sys/class/drm")) {
        if (!entry.is_directory()) continue;
        const std::string name = entry.path().filename().string();
        if (name.rfind("card", 0) != 0 || name.find('-') != std::string::npos) continue;
        const std::string lvl_path = entry.path().string() + "/device/power_dpm_force_performance_level";
        if (FILE* f = fopen(lvl_path.c_str(), "r")) {
            char lvl[32] = {};
            if (fgets(lvl, sizeof(lvl), f)) {
                lvl[strcspn(lvl, "\n")] = 0;
                fprintf(stderr, "[host] %s power_dpm_force_performance_level=%s\n", name.c_str(), lvl);
            }
            fclose(f);
        }
    }
    // Try to load ncnn pipeline cache (optional, ignore errors)
    {
        try {
            std::filesystem::create_directories(cache_dir);
            if (std::filesystem::exists(pipeline_cache_path)) {
                // PipelineCache loading via ncnn API would go here; for now RADV's cache is sufficient
                // Keeping hook for future explicit ncnn PipelineCache integration
                fprintf(stderr, "[host] pipeline cache file exists: %s (RADV caches shader, ncnn cache hook ready)\n", pipeline_cache_path.c_str());
            }
        } catch (...) {}
    }

    ncnn::Net net;
    net.opt.use_vulkan_compute = true;
    net.opt.num_threads = 4;
    net.opt.use_fp16_packed = use_fp16;
    net.opt.use_fp16_storage = use_fp16;
    net.opt.use_fp16_arithmetic = false;
    net.opt.use_winograd_convolution = true;
    net.opt.use_bf16_storage = false;
    // INT8-Pfad (nur mit quantisiertem Modell, sonst stiller Fallback auf
    // fp32-Layer — deshalb oben fail-fast ohne int8-Dateien).
    net.opt.use_int8_inference = use_int8;
    net.opt.use_int8_storage = use_int8;
    net.opt.use_int8_packed = use_int8;
    net.opt.use_int8_arithmetic = use_int8;

    const std::string& load_param = use_int8 ? int8_param : param_path;
    const std::string& load_bin = use_int8 ? int8_bin : bin_path;
    if (net.load_param(load_param.c_str()) != 0) {
        fprintf(stderr, "[host] failed to load param %s\n", load_param.c_str());
        return 1;
    }
    if (net.load_model(load_bin.c_str()) != 0) {
        fprintf(stderr, "[host] failed to load bin %s\n", load_bin.c_str());
        return 1;
    }
    fprintf(stderr, "[host] model loaded\n");

#if NCNN_VULKAN
    ncnn::Pipeline* postproc = nullptr;
    ncnn::Pipeline* preproc = nullptr;
    if (use_fp16) {
        postproc = new ncnn::Pipeline(device);
        postproc->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> specs(1);
        specs[0].i = 0;
        if (postproc->create(realesrgan_spike_postproc_comp_data, sizeof(realesrgan_spike_postproc_comp_data), specs) != 0) {
            fprintf(stderr, "[host] failed to create postproc pipeline\n");
            delete postproc;
            postproc = nullptr;
        } else {
            fprintf(stderr, "[host] GPU postproc ready\n");
        }
        // Preproc: RGBA8 -> planar fp16, avoids CPU loop + CPU cast
        preproc = new ncnn::Pipeline(device);
        preproc->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> pre_specs(1);
        pre_specs[0].i = 0;
        if (preproc->create(realesrgan_spike_preproc_comp_data, sizeof(realesrgan_spike_preproc_comp_data), pre_specs) != 0) {
            fprintf(stderr, "[host] failed to create preproc pipeline\n");
            delete preproc;
            preproc = nullptr;
        } else {
            fprintf(stderr, "[host] GPU preproc ready\n");
        }
    }
#endif

    // Persistent Vulkan allocators — acquired once, reused for every frame.
    // Avoids per-frame vkAllocate churn and mirrors benchmark S2 change.
    ncnn::VkAllocator* blob = device->acquire_blob_allocator();
    ncnn::VkAllocator* staging = device->acquire_staging_allocator();
    if (!blob || !staging) {
        fprintf(stderr, "[host] failed to acquire Vulkan allocators\n");
        if (blob) device->reclaim_blob_allocator(blob);
        if (staging) device->reclaim_staging_allocator(staging);
#if NCNN_VULKAN
        delete postproc;
        delete preproc;
#endif
        ncnn::destroy_gpu_instance();
        return 1;
    }
    fprintf(stderr, "[host] persistent allocators ready (blob=%p staging=%p)\n", (void*)blob, (void*)staging);

    // p7: shared upscale core used by the stdin framed-JSON handler and the
    // loopback HTTP transport. Single-pass for small frames, tiled (512/32)
    // above 1280x720, GPU pre/post-processing, latest-wins quality identical
    // between transports. `upscale_mutex` gives exclusive GPU ownership to
    // exactly one upscale at a time across both transports.
    // p8: optional tw/th presentation target — when the client knows the
    // canvas/display size, the postproc shader box-averages the network
    // output down to that size BEFORE the download, so the transported
    // payload shrinks from the full 4x frame (up to 59 MB at 720p input)
    // toward the display size (8–16 MB typically). The adaptive presentation
    // sampler already area-averages on the GPU; this moves the same math in
    // front of the transport, which is the expensive part.
    auto run_upscale = [&](const unsigned char* rgba, int width, int height,
                           int target_w, int target_h,
                           std::vector<unsigned char>& out, int& out_w, int& out_h,
                           std::string& err_msg) -> bool {
#if NCNN_VULKAN
        const long long px = (long long)width * height;
        const bool tiled = px > (long long)1280 * 720;
        ncnn::Option opt = net.opt;
        opt.blob_vkallocator = blob;
        opt.workspace_vkallocator = blob;
        opt.staging_vkallocator = staging;

        auto run_gpu_frame = [&](const unsigned char* rgba_src, int iw, int ih,
                                 int fw, int fh, // postproc target for THIS tile/frame
                                 std::vector<unsigned char>& frame_out, int& ow, int& oh,
                                 std::string& emsg) -> bool {
            // Spike lifetime rule: ONE VkCompute per inference, destroyed with
            // the frame's VkMats before the allocators are touched again.
            // Reusing a long-lived VkCompute across several submit_and_wait()
            // cycles (the tiled path) reliably SIGSEGVs inside RADV on the
            // second tile's submit — the command buffer scratch space is
            // recycled while the driver still references the previous
            // submission. The single-pass path used to share the persistent
            // frame_cmd from p3; per-frame is the only pattern that has ever
            // been validated with tiles, so use it everywhere.
            ncnn::VkCompute cmd(device);
            ncnn::Option topt = opt;
            ncnn::Mat tile_rgba_cpu(iw, ih, (size_t)4, 1u);
            memcpy(tile_rgba_cpu.data, rgba_src, (size_t)iw*ih*4);
            ncnn::VkMat rgba_gpu;
            rgba_gpu.create(iw, ih, (size_t)4, 1, blob);
            cmd.record_clone(tile_rgba_cpu, rgba_gpu, topt);
            ncnn::VkMat in_gpu_pre;
            in_gpu_pre.create(iw, ih, 3, (size_t)2, 1, blob);
            {
                std::vector<ncnn::VkMat> binds(2);
                binds[0] = rgba_gpu;
                binds[1] = in_gpu_pre;
                std::vector<ncnn::vk_constant_type> consts(3);
                consts[0].i = iw;
                consts[1].i = ih;
                consts[2].i = (int)in_gpu_pre.cstep; // real padded cstep from the blob
                ncnn::VkMat disp; disp.w = iw; disp.h = ih; disp.c = 1;
                cmd.record_pipeline(preproc, binds, consts, disp);
            }
            ncnn::VkMat out_gpu;
            {
                ncnn::Extractor ex = net.create_extractor();
                ex.set_blob_vkallocator(blob);
                ex.set_workspace_vkallocator(blob);
                ex.set_staging_vkallocator(staging);
                ex.input("data", in_gpu_pre);
                int ret = ex.extract("output", out_gpu, cmd);
                if (ret != 0) { emsg = "extractor extract failed"; return false; }
            }
            if (!postproc) { emsg = "gpu postproc pipeline unavailable"; return false; }
            // Clamp the presentation target to the network output; the shader
            // falls back to identity taps on any axis it does not shrink.
            const int pw = std::min(fw > 0 ? fw : out_gpu.w, out_gpu.w);
            const int ph = std::min(fh > 0 ? fh : out_gpu.h, out_gpu.h);
            ncnn::VkMat out_rgba_gpu;
            out_rgba_gpu.create(pw, ph, (size_t)4, 1, blob);
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
                cmd.record_pipeline(postproc, binds, consts, disp);
            }
            ncnn::Mat dst;
            cmd.record_clone(out_rgba_gpu, dst, topt);
            cmd.submit_and_wait();
            ow = dst.w; oh = dst.h;
            size_t need = (size_t)ow*oh*4;
            if (need != (size_t)dst.w*dst.h*4) { emsg = "gpu postproc size mismatch"; return false; }
            frame_out.resize(need);
            memcpy(frame_out.data(), dst.data, need);
            return true;
        };

        if (!tiled) {
            return run_gpu_frame(rgba, width, height, target_w, target_h, out, out_w, out_h, err_msg);
        }
        // Tile in input pixels. PAD covers model prepadding (10) + conv margin.
        const int TILE = 512, PAD = 32, scale = 4;
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
                if (!run_gpu_frame(tile.data(), ew, eh, 0, 0, tout, tw, th, terr)) {
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
    };

    std::mutex upscale_mutex;
    // Idle-Reaper-Uhr: beide Transporte (stdin-framed + HTTP-Loopback) melden
    // Aktivität; der HTTP-Pfad läuft auf einem eigenen Thread, daher atomar.
    // Millisekunden seit einem beliebigen steady_clock-Nullpunkt, nur für
    // Differenzen benutzt.
    auto now_ms = []() -> uint64_t {
        return (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
    };
    std::atomic<uint64_t> last_activity_ms{now_ms()};
    std::atomic<uint64_t> frames_served{0};
    aniwebscale::HttpTransport http_transport([&](const unsigned char* rgba_in, int in_w, int in_h,
                                                  int target_w, int target_h,
                                                  std::vector<unsigned char>& out, int& out_w, int& out_h,
                                                  std::string& emsg) -> int {
        std::lock_guard<std::mutex> lock(upscale_mutex);
        int rc = run_upscale(rgba_in, in_w, in_h, target_w, target_h, out, out_w, out_h, emsg) ? 0 : 1;
        if (rc == 0) {
            last_activity_ms.store(now_ms(), std::memory_order_relaxed);
            frames_served.fetch_add(1, std::memory_order_relaxed);
        }
        return rc;
    });
    {
        std::string http_err;
        if (http_transport.start(http_err)) {
            fprintf(stderr, "[host] http transport ready on 127.0.0.1:%d\n", http_transport.port());
        } else {
            fprintf(stderr, "[host] http transport FAILED: %s (stdin b64/shm paths still work)\n", http_err.c_str());
        }
    }

    // Main loop: poll() statt blockierendem Read, damit der Idle-Reaper
    // feuern kann, während stdin still ist. Jede eingehende Nachricht (auch
    // hello/capabilities) zählt als Aktivität.
    std::string payload;
    for (;;) {
        if (idle_timeout_s > 0) {
            const uint64_t now = now_ms();
            const uint64_t idle_ms = now - last_activity_ms.load(std::memory_order_relaxed);
            const uint64_t budget_ms = (uint64_t)idle_timeout_s * 1000;
            if (idle_ms >= budget_ms) {
                fprintf(stderr, "[host] idle timeout after %llu ms (%llu frames served): exiting, browser re-spawns on next frame\n",
                        (unsigned long long)idle_ms,
                        (unsigned long long)frames_served.load(std::memory_order_relaxed));
                fprintf(stderr, "[host] heap budget at idle exit=%u MB (start=%u MB)\n",
                        device->get_heap_budget(), heap_budget_start_mb);
                break;
            }
            struct pollfd pfd{STDIN_FILENO, POLLIN, 0};
            const uint64_t wait_ms = budget_ms - idle_ms;
            // poll takes int ms; clamp absurd timeouts instead of narrowing.
            int pr = poll(&pfd, 1, wait_ms > 60000ULL ? 60000 : (int)wait_ms);
            if (pr == 0) continue; // Timeout abgelaufen, oben neu prüfen
            if (pr < 0) {
                if (errno == EINTR) continue;
                fprintf(stderr, "[host] poll failed: %s\n", strerror(errno));
                break;
            }
            if (pfd.revents & (POLLHUP | POLLERR | POLLNVAL)) break; // Browser weg
        }
        if (!read_framed(payload)) break; // EOF: Browser hat den Port getrennt
        last_activity_ms.store(now_ms(), std::memory_order_relaxed);
        auto parsed = anime4k::json::parse(payload);
        if (!parsed.value || !parsed.value->is_object()) {
            fprintf(stderr, "[host] invalid json: %s\n", parsed.error.c_str());
            // send error
            Object err;
            err["type"] = Value("error");
            err["protocolVersion"] = Value(3.0);
            err["code"] = Value("invalid_json");
            err["message"] = Value(parsed.error);
            err["recoverable"] = Value(true);
            std::string out = anime4k::json::stringify(Value(err));
            write_framed(out);
            continue;
        }
        Object req = *parsed.value->as_object();
        std::string type = get_string(req, "type");
        std::string requestId = get_string(req, "requestId");
        // hello
        if (type == "hello") {
            Object resp;
            resp["type"] = Value("ready");
            resp["protocolVersion"] = Value(3.0);
            resp["requestId"] = Value(requestId);
            resp["httpPort"] = Value((double)http_transport.port());
            resp["httpToken"] = Value(http_transport.token());
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        if (type == "capabilities") {
            Object resp;
            resp["type"] = Value("capabilities");
            resp["protocolVersion"] = Value(3.0);
            resp["requestId"] = Value(requestId);
            resp["windowsCapture"] = Value(false);
            resp["d3d11"] = Value(false);
            resp["vulkanNcnn"] = Value(true);
            resp["realesrganVulkan"] = Value(true);
            resp["realesrganShm"] = Value(true);
            // p7: binary loopback transport (no base64, no preflight)
            resp["realesrganHttp"] = Value(http_transport.port() > 0);
            resp["httpPort"] = Value((double)http_transport.port());
            resp["httpToken"] = Value(http_transport.token());
            // p5: DMA-BUF zero-copy — advertised as unavailable until the browser
            // can hand out capture frames as DMA-BUF fds (no WebExtension API today).
            resp["realesrganDmaBuf"] = Value(false);
            // modes for compatibility
            std::vector<Value> modes; modes.emplace_back("REALESRGAN");
            resp["modes"] = Value(modes);
            std::vector<Value> quals; quals.emplace_back("M"); quals.emplace_back("VL"); quals.emplace_back("UL");
            resp["qualities"] = Value(quals);
            resp["frameGeneration"] = Value(false);
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        if (type == "realesrganUpscale" || type == "upscale") {
            int width = (int)get_number(req, "width", 0);
            int height = (int)get_number(req, "height", 0);
            int target_w = (int)get_number(req, "targetWidth", 0);
            int target_h = (int)get_number(req, "targetHeight", 0);
            std::string b64 = get_string(req, "data");
            std::string shmIn = get_string(req, "shmIn");
            std::string dmaBufIn = get_string(req, "dmaBufIn");
            if (!dmaBufIn.empty()) {
                // p5 stub: DMA-BUF import (VK_EXT_external_memory_dma_buf) needs a
                // browser-side capture path that exports frames as DMA-BUF fds.
                // No WebExtension API exposes this today; see artifacts report.
                Object err;
                err["type"] = Value("error");
                err["protocolVersion"] = Value(3.0);
                err["requestId"] = Value(requestId);
                err["code"] = Value("dma_buf_unsupported");
                err["message"] = Value("DMA-BUF import not available: browser capture cannot export DMA-BUF fds (no WebExtension API). Use shmIn/shmOut instead.");
                err["recoverable"] = Value(true);
                write_framed(anime4k::json::stringify(Value(err)));
                continue;
            }
            std::string shmOut = get_string(req, "shmOut");
            bool useShmIn = !shmIn.empty();
            bool useShmOut = !shmOut.empty();
            // fp16 request field kept for protocol compatibility; the shared
            // upscale core is fp16-storage GPU-only (validated path).
            [[maybe_unused]] bool reqFp16 = true;
            auto itfp = req.find("fp16");
            if (itfp != req.end()) {
                if (auto b = itfp->second.as_bool()) reqFp16 = *b;
                else if (auto n = itfp->second.as_number()) reqFp16 = *n != 0;
            }
            // width/height sanity
            if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || (b64.empty() && !useShmIn)) {
                Object err;
                err["type"] = Value("error");
                err["protocolVersion"] = Value(3.0);
                err["requestId"] = Value(requestId);
                err["code"] = Value("invalid_request");
                err["message"] = Value("missing width/height/data");
                err["recoverable"] = Value(true);
                write_framed(anime4k::json::stringify(Value(err)));
                continue;
            }
            std::vector<unsigned char> rgba;
            if (useShmIn) {
                int fd = ::open(shmIn.c_str(), O_RDONLY);
                if (fd < 0) {
                    Object err;
                    err["type"] = Value("error");
                    err["protocolVersion"] = Value(3.0);
                    err["requestId"] = Value(requestId);
                    err["code"] = Value("shm_open_failed");
                    err["message"] = Value(std::string("failed to open shmIn: ") + strerror(errno));
                    err["recoverable"] = Value(true);
                    write_framed(anime4k::json::stringify(Value(err)));
                    continue;
                }
                size_t need = (size_t)width*height*4;
                rgba.resize(need);
                size_t off = 0;
                while (off < need) {
                    ssize_t r = ::read(fd, rgba.data()+off, need-off);
                    if (r <= 0) {
                        if (r < 0 && errno == EINTR) continue;
                        break;
                    }
                    off += r;
                }
                ::close(fd);
                if (off != need) {
                    Object err;
                    err["type"] = Value("error");
                    err["protocolVersion"] = Value(3.0);
                    err["requestId"] = Value(requestId);
                    err["code"] = Value("shm_read_failed");
                    err["message"] = Value("shmIn size mismatch");
                    err["recoverable"] = Value(true);
                    write_framed(anime4k::json::stringify(Value(err)));
                    continue;
                }
            } else {
                if (!base64_decode(b64, rgba) || rgba.size() != (size_t)width*height*4) {
                    Object err;
                    err["type"] = Value("error");
                    err["protocolVersion"] = Value(3.0);
                    err["requestId"] = Value(requestId);
                    err["code"] = Value("invalid_data");
                    err["message"] = Value("base64 decode failed or size mismatch");
                    err["recoverable"] = Value(true);
                    write_framed(anime4k::json::stringify(Value(err)));
                    continue;
                }
            }

            auto t0 = std::chrono::steady_clock::now();
            std::vector<unsigned char> out_rgba;
            int out_w = 0, out_h = 0;
            std::string err_msg;
            // Shared upscale core (p7): identical GPU path for stdin and HTTP
            // transports; the mutex serializes GPU ownership between them.
            bool ok;
            {
                std::lock_guard<std::mutex> lock(upscale_mutex);
                ok = run_upscale(rgba.data(), width, height, target_w, target_h, out_rgba, out_w, out_h, err_msg);
            }
            if (ok) frames_served.fetch_add(1, std::memory_order_relaxed);
            if (!ok) {
                Object err;
                err["type"] = Value("error");
                err["protocolVersion"] = Value(3.0);
                err["requestId"] = Value(requestId);
                err["code"] = Value("inference_failed");
                err["message"] = Value(err_msg.empty() ? "unknown" : err_msg);
                err["recoverable"] = Value(true);
                write_framed(anime4k::json::stringify(Value(err)));
                continue;
            }
            auto t1 = std::chrono::steady_clock::now();
            double ms = std::chrono::duration<double,std::milli>(t1 - t0).count();
            fprintf(stderr, "[host] upscale %dx%d -> %dx%d %.1f ms\n", width, height, out_w, out_h, ms);
            if (useShmOut) {
                int fd = ::open(shmOut.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
                if (fd < 0) {
                    Object err;
                    err["type"] = Value("error");
                    err["protocolVersion"] = Value(3.0);
                    err["requestId"] = Value(requestId);
                    err["code"] = Value("shm_write_failed");
                    err["message"] = Value(std::string("failed to open shmOut: ") + strerror(errno));
                    err["recoverable"] = Value(true);
                    write_framed(anime4k::json::stringify(Value(err)));
                    continue;
                }
                size_t off = 0;
                size_t need = out_rgba.size();
                while (off < need) {
                    ssize_t w = ::write(fd, out_rgba.data()+off, need-off);
                    if (w <= 0) {
                        if (w < 0 && errno == EINTR) continue;
                        break;
                    }
                    off += w;
                }
                ::close(fd);
                if (off != need) {
                    Object err;
                    err["type"] = Value("error");
                    err["protocolVersion"] = Value(3.0);
                    err["requestId"] = Value(requestId);
                    err["code"] = Value("shm_write_incomplete");
                    err["message"] = Value("shmOut write incomplete");
                    err["recoverable"] = Value(true);
                    write_framed(anime4k::json::stringify(Value(err)));
                    continue;
                }
                Object resp;
                resp["type"] = Value("realesrganResult");
                resp["protocolVersion"] = Value(3.0);
                resp["requestId"] = Value(requestId);
                resp["width"] = Value((double)out_w);
                resp["height"] = Value((double)out_h);
                resp["shmOut"] = Value(shmOut);
                resp["timeMs"] = Value(ms);
                write_framed(anime4k::json::stringify(Value(resp)));
                continue;
            }
            std::string out_b64 = base64_encode(out_rgba.data(), out_rgba.size());
            Object resp;
            resp["type"] = Value("realesrganResult");
            resp["protocolVersion"] = Value(3.0);
            resp["requestId"] = Value(requestId);
            resp["width"] = Value((double)out_w);
            resp["height"] = Value((double)out_h);
            resp["data"] = Value(out_b64);
            resp["timeMs"] = Value(ms);
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        // unknown type
        Object err;
        err["type"] = Value("error");
        err["protocolVersion"] = Value(3.0);
        err["requestId"] = Value(requestId);
        err["code"] = Value("unknown_type");
        err["message"] = Value("unknown request type: " + type);
        err["recoverable"] = Value(true);
        write_framed(anime4k::json::stringify(Value(err)));
    }

    http_transport.stop();
    device->reclaim_blob_allocator(blob);
    device->reclaim_staging_allocator(staging);
#if NCNN_VULKAN
    delete postproc;
    delete preproc;
#endif
    // Lifetime rule from the spike: the Net must release its GPU resources
    // BEFORE the instance dies. `net` is a stack object whose destructor runs
    // only AFTER `return 0` — i.e. after destroy_gpu_instance() — which
    // SIGSEGVs in the driver (every clean shutdown exited -11). net.clear()
    // destroys the layers now, while the instance is still alive; the empty
    // Net destructor afterwards is a no-op.
    net.clear();
    ncnn::destroy_gpu_instance();
    fprintf(stderr, "[host] shutting down\n");
    return 0;
}
