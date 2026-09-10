/*
 * tiled-composer.h — the recompute-halo tiled compose/copy path of the
 * AniWebScale ncnn host, lifted out of UpscaleCore::run_upscale_impl.
 *
 * Owns the persistent tiled-path staging buffers (compose output, tile input
 * gathering, per-tile network output, per-tile GPU box-downscale output) and
 * the two tile loops: the exact-integer per-tile GPU downscale that stitches
 * core regions straight into the presentation target, and the full-4x compose
 * followed by one CPU box-average pass. The single-pass path and run_gpu_frame
 * are unchanged and stay in UpscaleCore.
 *
 * No mutex of its own: the caller holds UpscaleCore::upscale_mutex_ for the
 * whole compose(), so exactly one compose runs at a time and the reused
 * buffers have a single writer. run_gpu_frame is reached under that same
 * mutex through the passed GpuRuntime.
 */

#pragma once

#include <string>
#include <vector>

#include "gpu-runtime.h"

namespace aniwebscale {

class TiledComposer {
public:
    TiledComposer() = default;
    TiledComposer(const TiledComposer&) = delete;
    TiledComposer& operator=(const TiledComposer&) = delete;

    // Compose the tiled frame `rgba` (width x height, already the network
    // input) into `out`. Fills out_w/out_h; on failure sets err_msg and, when
    // non-null, *err_stage to "tile". Returns false on any tile failure.
    // Precondition: isTiledFrame(width, height) and the caller holds the GPU
    // serialization (UpscaleCore::upscale_mutex_) for the whole call.
    bool compose(GpuRuntime& runtime, const unsigned char* rgba,
                 int width, int height, int target_w, int target_h,
                 std::vector<unsigned char>& out, int& out_w, int& out_h,
                 std::string& err_msg, bool wantSrvgg, std::string* err_stage);

private:
    // Persistent tiled-path staging (mutex-held by the caller, see the tiled
    // branch in compose()): compose output, tile input gathering and per-tile
    // network output. Reused across frames to avoid per-frame big mallocs +
    // the full-frame memset; the tile cores partition the frame so no fill is
    // needed. tile_downscaled_ is the per-tile GPU box-downscale output.
    std::vector<unsigned char> tiled_output_;
    std::vector<unsigned char> tile_input_;
    std::vector<unsigned char> tile_output_;
    std::vector<unsigned char> tile_downscaled_;
};

} // namespace aniwebscale
