/*
 * frame-plan.h — pure per-frame geometry decisions for the ncnn host.
 *
 * The frame pipeline (UpscaleCore) owns the GPU and the buffers; these
 * helpers own only the arithmetic decisions: when a frame is tiled, and
 * whether the tiled path may box-downscale each tile on the GPU and stitch
 * the cores (the exact-integer factor alignment check). Moved out of
 * UpscaleCore::run_upscale_impl, unchanged.
 */

#pragma once

#include <algorithm>
#include <cstddef>

namespace aniwebscale {

// ncnn wraps a dims=2 Mat with Mat::total() == cstep, i.e. the 16-byte-aligned
// byte count. record_clone's upload/download memcpy moves total()*elemsize
// bytes, so any external buffer handed to ncnn must be allocated to that
// padded size or the copy runs up to 12 bytes past the end (heap overflow for
// tile sizes whose w*h*4 is not 16-aligned, e.g. 675x675).
inline size_t alignedFrameBytes(size_t bytes) {
    return (bytes + 15u) & ~(size_t)15u;
}

// Tiled threshold in input pixels: above 1280x720 the frame goes through the
// recompute-halo tiler (TILE/PAD are model properties owned by the caller).
constexpr long long kTiledPixelThreshold = (long long)1280 * 720;

inline bool isTiledFrame(int width, int height) {
    return (long long)width * height > kTiledPixelThreshold;
}

// Plan the per-tile GPU box-downscale factor f for a tiled frame with a
// presentation target. Returns f (>1) only when the 4x output is an exact
// integer f shrink of the target AND every tile's core/halo grid lines up
// with the global downscale grid (TILE/PAD are multiples of 3, so the common
// display ratios align). Returns 0 when the CPU box pass must be used.
inline int planTileDownscaleFactor(int width, int height,
                                   int target_w, int target_h,
                                   int out_w, int out_h,
                                   int tile, int pad, int scale) {
    const bool downscale = target_w > 0 && target_h > 0
        && (target_w < out_w || target_h < out_h);
    if (!downscale || out_w % target_w != 0 || out_h % target_h != 0) return 0;
    const int fw = out_w / target_w, fh = out_h / target_h;
    if (fw != fh || fw <= 1) return 0;
    const int f = fw;
    for (int ty = 0; ty < height; ty += tile) {
        const int cy1 = std::min(ty + tile, height);
        const int ey0 = std::max(0, ty - pad), ey1 = std::min(height, cy1 + pad);
        if ((ey0 * scale) % f != 0 || ((ty - ey0) * scale) % f != 0
            || ((cy1 - ty) * scale) % f != 0 || ((ey1 - ey0) * scale) % f != 0) return 0;
    }
    for (int tx = 0; tx < width; tx += tile) {
        const int cx1 = std::min(tx + tile, width);
        const int ex0 = std::max(0, tx - pad), ex1 = std::min(width, cx1 + pad);
        if ((ex0 * scale) % f != 0 || ((tx - ex0) * scale) % f != 0
            || ((cx1 - tx) * scale) % f != 0 || ((ex1 - ex0) * scale) % f != 0) return 0;
    }
    return f;
}

} // namespace aniwebscale
