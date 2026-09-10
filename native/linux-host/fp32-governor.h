/*
 * fp32-governor.h — the pure load rule of the fp32-storage speed lever.
 *
 * True fp32 storage is ~2.5x slower than fp16. With a known presentation
 * target and a single-pass frame, the governor picks a fractional inference
 * scale that fits the frame budget and lets the postproc bilinear-upscale
 * the network output to the target. The caller owns the box-downscale; this
 * header owns only the scale arithmetic (moved out of
 * UpscaleCore::run_upscale_impl, unchanged).
 */

#pragma once

#include <algorithm>
#include <cmath>

namespace aniwebscale {

// Governor tuning: target frame budget (ms), calibrated net cost (ms per
// input pixel) and the lowest allowed inference scale. budget <= 0 disables.
struct Fp32GovernorParams {
    double budget_ms = 0.0;
    double ms_per_px = 3.0e-4;
    double min_scale = 0.5;
};

// Decide the governor's inference dimensions for an fp32 single-pass frame.
// Returns false when the governor does not engage (no budget, no target, or
// the frame is above the tiled/product cap); true means nw/nh are a real
// reduction the caller must box-downscale into.
inline bool planFp32Governor(int width, int height, int target_w, int target_h,
                             const Fp32GovernorParams& p, int& nw, int& nh) {
    if (!(p.budget_ms > 0 && target_w > 0 && target_h > 0)) return false;
    const long long full_px = (long long)width * height;
    if (!(full_px > 0 && full_px <= (long long)1280 * 720)) return false;
    const double budget_px = p.budget_ms / p.ms_per_px;
    double s = std::sqrt(budget_px / (double)full_px);
    if (s > 1.0) s = 1.0;
    if (s < p.min_scale) s = p.min_scale;
    nw = std::max(2, (int)std::lround((double)width * s));
    nh = std::max(2, (int)std::lround((double)height * s));
    return nw < width || nh < height;
}

} // namespace aniwebscale
