/*
 * gpu-frame.h — one full Vulkan GPU frame (upload → preproc → ncnn/SRVGG →
 * postproc → download) for the ncnn host.
 *
 * Extracted byte-for-byte from UpscaleCore::run_upscale_impl's former
 * run_gpu_frame lambda: the command-recording sequence, binding order, staging
 * lifetime rules and precision selection are unchanged. The function is
 * parameterized by the GpuRuntime context (device, allocators, pre/postproc
 * pipelines, net, lazy SRVGG backend); the caller (UpscaleCore or
 * TiledComposer under UpscaleCore's mutex) keeps sole ownership of the GPU
 * serialization.
 */

#pragma once

#include <string>
#include <vector>

#include "gpu-runtime.h"

namespace aniwebscale {

// Result of one GPU frame/tile. `stage` is the failure phase (upload before
// the final submit, submit for the submit/download) — the caller maps it onto
// the inference_failed `stage` field and the HTTP error text.
struct GpuFrameOutcome {
    int out_w = 0;
    int out_h = 0;
    std::string error;
    std::string stage;
};

// Records, submits and downloads exactly one frame (or tile). Returns false
// with `outcome` filled on failure. The caller must hold the GPU
// serialization (UpscaleCore::upscale_mutex_) for the whole call.
bool run_gpu_frame(GpuRuntime& runtime, const unsigned char* rgba_src,
                   int iw, int ih, int fw, int fh,
                   bool allow_srvgg, bool want_srvgg,
                   bool pre_down2, int full_w, int full_h,
                   std::vector<unsigned char>& frame_out, GpuFrameOutcome& outcome);

} // namespace aniwebscale
