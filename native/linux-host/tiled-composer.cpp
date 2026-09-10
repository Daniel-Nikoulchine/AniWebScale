#include "tiled-composer.h"

#include <algorithm>
#include <cstring>
#include <thread>

#include "box-downscale.h"
#include "frame-plan.h"
#include "gpu-frame.h"

namespace aniwebscale {

bool TiledComposer::compose(GpuRuntime& runtime, const unsigned char* rgba,
                            int width, int height, int target_w, int target_h,
                            std::vector<unsigned char>& out, int& out_w, int& out_h,
                            std::string& err_msg, bool wantSrvgg, std::string* err_stage) {
    auto set_stage = [&](const char* stage) {
        if (err_stage != nullptr) *err_stage = stage;
    };
    // Tile in input pixels. PAD covers model prepadding (10) + conv margin.
    // Stufe 4 (Overlap-Tuning, Tile-Kurve 1080p-full, host-latency-bench):
    // n=5: 480:399ms, 512:396ms, 576:395ms, 640:398ms, 960:470ms;
    // n=10: 576:396.0ms vs 640:396.9ms (Rauschen). 480-640 flach,
    // 960 +18% (Working-Set). 640 bleibt; PAD=32 ist Model-Eigenschaft.
    const int TILE = 642, PAD = 33, scale = 4;
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
    // box-average pass over the composed bytes on the CPU. When the
    // presentation target is an exact integer shrink f of the 4x output
    // and every tile's target grid lines up with the global one, each tile
    // is instead box-downscaled on the GPU and its core copied straight
    // into the target, so the full-4x per-tile download and the CPU
    // compose+downscale disappear. TILE/PAD are multiples of 3, so the
    // common display ratios f=2/3/4/6 align for typical widths; anything
    // that fails the per-tile check keeps the CPU box pass.
    out_w = width * scale; out_h = height * scale;
    const bool downscale = target_w > 0 && target_h > 0
        && (target_w < out_w || target_h < out_h);
    const int tile_ds_factor = planTileDownscaleFactor(
        width, height, target_w, target_h, out_w, out_h, TILE, PAD, scale);
    if (tile_ds_factor > 0) {
        set_stage("tile");
        const int f = tile_ds_factor;
        const int ds_w = out_w / f, ds_h = out_h / f; // == target_w / target_h
        if (out.size() != (size_t)ds_w * ds_h * 4) out.resize((size_t)ds_w * ds_h * 4);
        unsigned char* ds_dst = out.data();
        for (int ty = 0; ty < height; ty += TILE) {
            for (int tx = 0; tx < width; tx += TILE) {
                int cx0 = tx, cy0 = ty;
                int cx1 = std::min(tx + TILE, width), cy1 = std::min(ty + TILE, height);
                int ex0 = std::max(0, cx0 - PAD), ey0 = std::max(0, cy0 - PAD);
                int ex1 = std::min(width, cx1 + PAD), ey1 = std::min(height, cy1 + PAD);
                int ew = ex1 - ex0, eh = ey1 - ey0;
                const size_t tile_need = (size_t)ew * eh * 4;
                const size_t tile_alloc = alignedFrameBytes(tile_need);
                if (tile_input_.size() < tile_alloc) tile_input_.resize(tile_alloc);
                unsigned char* tile = tile_input_.data();
                for (int y = 0; y < eh; ++y) {
                    memcpy(tile + (size_t)y * ew * 4,
                           rgba + ((size_t)(ey0 + y) * width + ex0) * 4,
                           (size_t)ew * 4);
                }
                const int dtw = (ew * scale) / f, dth = (eh * scale) / f;
                GpuFrameOutcome outcome;
                if (!run_gpu_frame(runtime, tile, ew, eh, dtw, dth,
                                   false, wantSrvgg, false, 0, 0, tile_downscaled_, outcome)) {
                    err_msg = outcome.error.empty() ? "tile failed" : outcome.error;
                    set_stage("tile");
                    return false;
                }
                const int tw = outcome.out_w;
                // Core region in the downscaled tile → its slot in the
                // target. The alignment check above keeps every offset
                // integral and the box windows identical to the global
                // downscale.
                const int gx0 = (cx0 * scale) / f, gy0 = (cy0 * scale) / f;
                const int ox = ((cx0 - ex0) * scale) / f, oy = ((cy0 - ey0) * scale) / f;
                const int cw = ((cx1 - cx0) * scale) / f, ch = ((cy1 - cy0) * scale) / f;
                const unsigned char* src = tile_downscaled_.data();
                for (int y = 0; y < ch; ++y) {
                    memcpy(ds_dst + (((size_t)(gy0 + y) * ds_w) + gx0) * 4,
                           src + ((size_t)(oy + y) * tw + ox) * 4,
                           (size_t)cw * 4);
                }
            }
        }
        out_w = ds_w; out_h = ds_h;
        return true;
    }
    const int comp_w = out_w, comp_h = out_h; // compose size
    // Persistent compose/tile buffers (mutex-held, single in-flight
    // upscale): the core regions partition the full frame, so every byte
    // is overwritten below — no per-frame zero-fill (1080p: 132 MB
    // memset saved) and no per-tile malloc/free churn. swap() hands the
    // filled buffer to the caller and keeps their old one for next frame.
    const size_t comp_bytes = (size_t)out_w * out_h * 4;
    if (tiled_output_.size() != comp_bytes) tiled_output_.resize(comp_bytes);
    unsigned char* comp = tiled_output_.data();
    for (int ty = 0; ty < height; ty += TILE) {
        for (int tx = 0; tx < width; tx += TILE) {
            int cx0 = tx, cy0 = ty;
            int cx1 = std::min(tx + TILE, width), cy1 = std::min(ty + TILE, height);
            int ex0 = std::max(0, cx0 - PAD), ey0 = std::max(0, cy0 - PAD);
            int ex1 = std::min(width, cx1 + PAD), ey1 = std::min(height, cy1 + PAD);
            int ew = ex1 - ex0, eh = ey1 - ey0;
            const size_t tile_need = (size_t)ew * eh * 4;
            const size_t tile_alloc = alignedFrameBytes(tile_need);
            if (tile_input_.size() < tile_alloc) tile_input_.resize(tile_alloc);
            unsigned char* tile = tile_input_.data();
            for (int y = 0; y < eh; ++y) {
                memcpy(tile + (size_t)y * ew * 4,
                       rgba + ((size_t)(ey0 + y) * width + ex0) * 4,
                       (size_t)ew * 4);
            }
            GpuFrameOutcome outcome;
            if (!run_gpu_frame(runtime, tile, ew, eh, 0, 0,
                               false, wantSrvgg, false, 0, 0, tile_output_, outcome)) {
                err_msg = outcome.error.empty() ? "tile failed" : outcome.error;
                set_stage("tile");
                return false;
            }
            const int tw = outcome.out_w;
            // Copy core region: core input (cx0..cx1)x(cy0..cy1) → output*4
            int owx0 = (cx0 - ex0) * scale, owy0 = (cy0 - ey0) * scale;
            int core_w = (cx1 - cx0) * scale, core_h = (cy1 - cy0) * scale;
            int ox = cx0 * scale, oy = cy0 * scale;
            const unsigned char* tiled_out = tile_output_.data();
            for (int y = 0; y < core_h; ++y) {
                memcpy(comp + (((size_t)(oy + y) * out_w) + ox) * 4,
                       tiled_out + ((size_t)(owy0 + y) * tw + owx0) * 4,
                       (size_t)core_w * 4);
            }
        }
    }
    if (downscale) {
        // Exact box average, same weights as the shader (fractional
        // edges). ONE float path for every geometry: the old integer
        // "fast lane" for exact power-of-two factors did a runtime
        // integer division per channel per output pixel and measured
        // 5-7x SLOWER than this loop (standalone + host A/B) - removed.
        // This loop is bit-identical for those factors anyway: 1/area is
        // exact and every partial sum stays < 2^24 in float32.
        const int nw = std::min(target_w, comp_w);
        const int nh = std::min(target_h, comp_h);
        std::vector<unsigned char> small((size_t)nw * nh * 4);
        // The CPU box pass is compute-bound (~2.4 cycles/tap) and reads the
        // whole composed frame; split the output rows across cores. Each
        // row writes disjoint bytes of `small` and only reads `comp`, so
        // the result is bit-identical to the single-threaded loop.
        auto downscale_rows = [&](int ry_begin, int ry_end) {
            boxDownscaleRgba8Rows(comp, comp_w, comp_h, small.data(), nw, nh,
                                  ry_begin, ry_end);
        };
        const unsigned hw_threads = std::thread::hardware_concurrency();
        const int want_threads = std::max(1, std::min<int>((int)(hw_threads ? hw_threads : 1), 8));
        const int rows_per_thread = (nh + want_threads - 1) / want_threads;
        if (want_threads <= 1 || rows_per_thread == 0) {
            downscale_rows(0, nh);
        } else {
            std::vector<std::thread> workers;
            workers.reserve((size_t)want_threads);
            bool spawn_failed = false;
            try {
                for (int t = 0; t < want_threads; ++t) {
                    const int a = t * rows_per_thread;
                    const int b = std::min(nh, a + rows_per_thread);
                    if (a < b) workers.emplace_back(downscale_rows, a, b);
                }
            } catch (...) {
                // Thread creation failed (resource exhaustion): join what
                // exists first (a joinable std::thread destructor would
                // terminate), then recompute every row on this thread.
                // Rows are independent and idempotent, so the recompute is
                // bit-identical.
                spawn_failed = true;
            }
            for (auto& worker : workers) worker.join();
            if (spawn_failed) downscale_rows(0, nh);
        }
        out.swap(small);
        out_w = nw; out_h = nh;
    } else {
        out.swap(tiled_output_);
    }
    return true;
}

} // namespace aniwebscale
