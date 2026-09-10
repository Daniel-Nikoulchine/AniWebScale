/*
 * box-downscale.h — shared CPU fractional box-average for RGBA8 frames.
 *
 * One formula for every host geometry (infer-div CPU pre-downscale, fp32
 * governor, tiled compose downscale): a pure per-output-pixel area average
 * with fractional edge weights, quantizing once at the end. This is the
 * exact math the three former inline loops used (moved, not rewritten), so
 * callers keep bit-identical output. Rows are independent, which lets the
 * tiled path fan the same helper across threads.
 */

#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>

namespace aniwebscale {

// Average src (src_w x src_h RGBA8) down into dst (dst_w x dst_h RGBA8),
// writing only output rows [row_begin, row_end). Every output pixel gets
// alpha 255. The source window is read for every written row, so callers
// must not overlap dst with src.
inline void boxDownscaleRgba8Rows(const unsigned char* src, int src_w, int src_h,
                                  unsigned char* dst, int dst_w, int dst_h,
                                  int row_begin, int row_end) {
    for (int y = row_begin; y < row_end; ++y) {
        const float y0f = (float)y * src_h / dst_h;
        const float y1f = (float)(y + 1) * src_h / dst_h;
        const int y0 = (int)floorf(y0f), y1 = (int)ceilf(y1f);
        for (int x = 0; x < dst_w; ++x) {
            const float x0f = (float)x * src_w / dst_w;
            const float x1f = (float)(x + 1) * src_w / dst_w;
            const int x0 = (int)floorf(x0f), x1 = (int)ceilf(x1f);
            float ar = 0, ag = 0, ab = 0, wsum = 0;
            for (int sy = y0; sy < y1; ++sy) {
                const float wy = std::min(y1f, (float)sy + 1) - std::max(y0f, (float)sy);
                if (wy <= 0) continue;
                for (int sx = x0; sx < x1; ++sx) {
                    const float wx = std::min(x1f, (float)sx + 1) - std::max(x0f, (float)sx);
                    if (wx <= 0) continue;
                    const float wgt = wx * wy;
                    const unsigned char* px4 = src + (((size_t)sy * src_w) + sx) * 4;
                    ar += px4[0] * wgt; ag += px4[1] * wgt; ab += px4[2] * wgt;
                    wsum += wgt;
                }
            }
            const float inv = 1.0f / std::max(wsum, 1e-6f);
            unsigned char* d = dst + (((size_t)y * dst_w) + x) * 4;
            d[0] = (unsigned char)std::min(255.0f, floorf(ar * inv + 0.5f));
            d[1] = (unsigned char)std::min(255.0f, floorf(ag * inv + 0.5f));
            d[2] = (unsigned char)std::min(255.0f, floorf(ab * inv + 0.5f));
            d[3] = 255;
        }
    }
}

// Full-frame convenience form of boxDownscaleRgba8Rows.
inline void boxDownscaleRgba8(const unsigned char* src, int src_w, int src_h,
                              unsigned char* dst, int dst_w, int dst_h) {
    boxDownscaleRgba8Rows(src, src_w, src_h, dst, dst_w, dst_h, 0, dst_h);
}

} // namespace aniwebscale
