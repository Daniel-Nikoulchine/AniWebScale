/*
 * UpscaleCore: the serialized GPU/inference coordinator of the AniWebScale
 * ncnn host. Owns the per-frame staging buffers, the exclusive-GPU mutex, the
 * idle clock and the served-frame counter, and drives the per-frame
 * Vulkan/ncnn pipeline (run_upscale_impl, moved byte-for-byte out of main()'s
 * run_upscale lambda — moved, not rewritten).
 *
 * The GPU resources themselves (device, ncnn Net, allocators, pre/postproc
 * pipelines, lazy srvgg backend, precision policy) live behind GpuRuntime;
 * the tiled path's persistent staging buffers and recompute-halo compose/copy
 * loops live in TiledComposer (reached under UpscaleCore's mutex); the pure
 * per-frame geometry/target decisions live in frame-plan.h and
 * fp32-governor.h, and the shared CPU box-average in box-downscale.h.
 *
 * Both transports (framed stdin/stdout JSON, loopback HTTP) are thin adapters
 * around this interface. The idle clock is deliberately NOT bumped by
 * run_upscale: each transport reports activity explicitly (the stdin loop on
 * message receipt, the HTTP handler on a successful frame), preserving the
 * original semantics. run_upscale only increments the served-frame counter.
 *
 * Lifecycle (forwarded to GpuRuntime):
 *   init_device()  — gpu instance + device selection + report (false = fatal)
 *   load_models()  — ncnn net, custom pipelines, persistent allocators
 *   run_upscale()  — per-frame entry, exclusive GPU ownership via mutex
 *   shutdown()     — reclaim + net.clear + destroy instance (in that order)
 */

#pragma once

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <new>
#include <string>
#include <thread>
#include <vector>

#include "box-downscale.h"
#include "fp32-governor.h"
#include "frame-plan.h"
#include "gpu-frame.h"
#include "tiled-composer.h"
#include "gpu-runtime.h"
#include "srvgg-vulkan.h"

namespace aniwebscale {

class UpscaleCore {
public:
    UpscaleCore() = default;
    ~UpscaleCore() = default; // shutdown() must run before the instance dies
    UpscaleCore(const UpscaleCore&) = delete;
    UpscaleCore& operator=(const UpscaleCore&) = delete;

    bool init_device() { return runtime_.init_device(); }

    void load_pipeline_cache(const std::string& path, const std::string& cache_dir) {
        runtime_.load_pipeline_cache(path, cache_dir);
    }

    bool load_models(const UpscaleCoreConfig& cfg) { return runtime_.load_models(cfg); }

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
                     std::string& err_msg, const std::string& engine = "",
                     std::string* err_stage = nullptr) {
        std::lock_guard<std::mutex> lock(upscale_mutex_);
        // Failure phase for the error reply ("upload" until the frame reaches
        // the GPU submit; "tile" in the tiled compose path). Defaulted here so
        // a bad_alloc thrown before the impl sets it still reports a stage.
        if (err_stage != nullptr && err_stage->empty()) *err_stage = "upload";
        // A giant frame (up to 4096px per side) can exhaust RAM in a staging
        // resize (a 4096^2 tiled compose is 1 GiB): fail the frame loudly so
        // the client falls back instead of dying on an uncaught bad_alloc.
        // (ncnn itself reports via return codes, so this cannot mask GPU
        // errors — it only converts OOM termination into inference_failed.)
        bool ok = false;
        try {
            ok = run_upscale_impl(rgba, width, height, target_w, target_h,
                                  out, out_w, out_h, err_msg, engine, err_stage);
        } catch (const std::bad_alloc&) {
            err_msg = "out of memory for frame staging";
            ok = false;
        }
        if (ok) frames_served_.fetch_add(1, std::memory_order_relaxed);
        return ok;
    }

    void save_pipeline_cache(const std::string& path) { runtime_.save_pipeline_cache(path); }

    // Stufe 5 (Session-Warmup): 2 tiny frames through the full run_upscale
    // path (one untargeted 4x, one with presentation target to also warm the
    // div2/down2 + postproc-downscale branches when enabled). Moves the
    // first-dispatch/compile tax from the first served frame to process
    // startup. Returns total warmup ms. Idempotent per process.
    double warmup() {
        auto t0 = std::chrono::steady_clock::now();
        std::vector<unsigned char> rgba((size_t)320 * 240 * 4);
        for (int y = 0; y < 240; ++y)
            for (int x = 0; x < 320; ++x) {
                unsigned char* d = rgba.data() + (((size_t)y * 320) + x) * 4;
                d[0] = (unsigned char)((x * 3) & 0xff);
                d[1] = (unsigned char)((y * 5) & 0xff);
                d[2] = (unsigned char)(((x + y) * 7) & 0xff);
                d[3] = 255;
            }
        for (int i = 0; i < 2; ++i) {
            std::vector<unsigned char> out;
            int ow = 0, oh = 0;
            std::string err;
            // i==0: full 4x, no target; i==1: with target (div2 path when on).
            const int tw = (i == 0) ? 0 : 320, th = (i == 0) ? 0 : 240;
            if (!run_upscale(rgba.data(), 320, 240, tw, th, out, ow, oh, err)) {
                fprintf(stderr, "[host] warmup frame %d failed: %s\n", i, err.c_str());
                break;
            }
        }
        const double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - t0).count();
        fprintf(stderr, "[host] session warmup done in %.1f ms\n", ms);
        return ms;
    }

    void shutdown() { runtime_.shutdown(); }

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
    ncnn::VulkanDevice* device() const { return runtime_.device(); }
    ncnn::VkAllocator* blob_allocator() const { return runtime_.blob_allocator(); }
    ncnn::VkAllocator* staging_allocator() const { return runtime_.staging_allocator(); }
    uint32_t heap_budget_start_mb() const { return runtime_.heap_budget_start_mb(); }

private:

    // Body of the former run_upscale lambda, moved verbatim (local variables
    // became members). Caller must hold upscale_mutex_.
    bool run_upscale_impl(const unsigned char* rgba, int width, int height,
                          int target_w, int target_h,
                          std::vector<unsigned char>& out, int& out_w, int& out_h,
                          std::string& err_msg, const std::string& engine,
                          std::string* err_stage) {
        auto set_stage = [&](const char* stage) {
            if (err_stage != nullptr) *err_stage = stage;
        };
        set_stage("upload");
#if NCNN_VULKAN
        // Stufe 1: infer-div=2 halbiert den Netz-Input per exaktem Box-Average
        // (fraktionale Kanten). target_w/h bleiben Presentation-Ziele; der
        // bestehende p8-Pfad skaliert das 2x-Netz-Output per GPU-Shader runter.
        // Tiled-Schwelle greift auf dem kleinen Input (automatisch seltener).
        // Nur mit Presentation-Target: ohne target gilt weiter voll 4x.
        std::vector<unsigned char> small;
        // Stufe 2: GPU-pre halves the full frame on the GPU (single-pass
        // only; the tiled path keeps the exact CPU loop so tile seams stay
        // bit-identical). Null pipeline => CPU-loop fallback.
        bool gpu_pre_down2 = false;
        int full_w = 0, full_h = 0;
        if (runtime_.infer_div() == 2 && target_w > 0 && target_h > 0 && width >= 2 && height >= 2) {
            const int sw = (width + 1) / 2, sh = (height + 1) / 2;
            const bool small_tiled = isTiledFrame(sw, sh);
            if (runtime_.preproc_down2() != nullptr && !small_tiled) {
                gpu_pre_down2 = true;
                full_w = width;
                full_h = height;
                width = sw;
                height = sh;
            } else {
            small.assign((size_t)sw * sh * 4, 0);
            boxDownscaleRgba8(rgba, width, height, small.data(), sw, sh);
            rgba = small.data();
            width = sw;
            height = sh;
            } // else: CPU-loop fallback (tiled or no down2 pipeline)
        }
        // fp32 governor (quality-gated speed lever): true fp32 storage is
        // ~2.5x slower than fp16 and misses the 15 fps budget at the full cap
        // on NAVI22. With a known presentation target and a single-pass frame,
        // pick a fractional inference scale that fits fp32_budget_ms_ and let
        // the postproc bilinear-upscale the network output to the target.
        // Quality loss is bounded by the budget and fp32_min_scale_; fp16 mode
        // is untouched. Single-pass only: the tiled compose path keeps its
        // full-resolution seam math (and the product cap never tiles).
        {
            int nw = 0, nh = 0;
            const Fp32GovernorParams governor{runtime_.fp32_budget_ms(),
                                              runtime_.fp32_ms_per_px(),
                                              runtime_.fp32_min_scale()};
            if (!runtime_.use_fp16()
                && planFp32Governor(width, height, target_w, target_h, governor, nw, nh)) {
                fp32_scaled_.assign((size_t)nw * nh * 4, 0);
                boxDownscaleRgba8(rgba, width, height, fp32_scaled_.data(), nw, nh);
                rgba = fp32_scaled_.data();
                width = nw;
                height = nh;
            }
        }
        const bool tiled = isTiledFrame(width, height);
        // E4 selection: explicit per-request engine wins; otherwise the
        // process env default applies (probes + back-compat). Unknown values
        // fall back to ncnn.
        const bool wantSrvgg = !engine.empty() ? (engine == "srvgg") : runtime_.use_srvgg_engine();

        if (!tiled) {
            GpuFrameOutcome outcome;
            if (!run_gpu_frame(runtime_, rgba, width, height, target_w, target_h,
                               true, wantSrvgg, gpu_pre_down2, full_w, full_h, out, outcome)) {
                err_msg = outcome.error;
                set_stage(outcome.stage.empty() ? "upload" : outcome.stage.c_str());
                return false;
            }
            out_w = outcome.out_w;
            out_h = outcome.out_h;
            return true;
        }
        return tiled_composer_.compose(runtime_, rgba, width, height,
                                       target_w, target_h, out, out_w, out_h,
                                       err_msg, wantSrvgg, err_stage);
#else
        (void)rgba; (void)width; (void)height; (void)out; (void)out_w; (void)out_h;
        err_msg = "built without Vulkan support";
        return false;
#endif
    }

    GpuRuntime runtime_;
    std::vector<unsigned char> fp32_scaled_; // governor's downsampled input
    TiledComposer tiled_composer_;

    std::mutex upscale_mutex_;
    std::atomic<uint64_t> last_activity_ms_{now_ms()};
    std::atomic<uint64_t> frames_served_{0};
};

} // namespace aniwebscale
