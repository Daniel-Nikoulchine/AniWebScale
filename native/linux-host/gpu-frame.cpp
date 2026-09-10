/*
 * gpu-frame.cpp — Vulkan command recording/submit/download for one frame.
 * See gpu-frame.h. Body moved verbatim out of UpscaleCore::run_upscale_impl;
 * `runtime_` became the `runtime` parameter, the output refs became
 * GpuFrameOutcome, and the captured `opt` is reconstructed from the runtime.
 */

#include "gpu-frame.h"

#include <cstdio>
#include <cstring>

#include "frame-plan.h"
#include "srvgg-vulkan.h"

namespace aniwebscale {

#if NCNN_VULKAN
bool run_gpu_frame(GpuRuntime& runtime, const unsigned char* rgba_src,
                   int iw, int ih, int fw, int fh,
                   bool allow_srvgg, bool want_srvgg,
                   bool pre_down2, int full_w, int full_h,
                   std::vector<unsigned char>& frame_out, GpuFrameOutcome& outcome) {
    auto set_stage = [&](const char* stage) { outcome.stage = stage; };
    // Reconstructed from the runtime exactly as the caller used to build it
    // once per upscale; net().opt is never mutated between frames.
    ncnn::Option opt = runtime.net().opt;
    opt.blob_vkallocator = runtime.blob_allocator();
    opt.workspace_vkallocator = runtime.blob_allocator();
    opt.staging_vkallocator = runtime.staging_allocator();

    // Spike lifetime rule: ONE VkCompute per inference, destroyed with
    // the frame's VkMats before the allocators are touched again.
    // Reusing a long-lived VkCompute across several submit_and_wait()
    // cycles (the tiled path) reliably SIGSEGVs inside RADV on the
    // second tile's submit — the command buffer scratch space is
    // recycled while the driver still references the previous
    // submission. The single-pass path used to share the persistent
    // frame_cmd from p3; per-frame is the only pattern that has ever
    // been validated with tiles, so use it everywhere.
    ncnn::VkCompute cmd(runtime.device());
    ncnn::Option topt = opt;
    // fp32 storage runs the whole chain with 32-bit channels; fp16
    // uses 16-bit. Selected once per frame from the process mode.
    const size_t act_elemsize = runtime.use_fp16() ? (size_t)2 : (size_t)4;
    ncnn::Pipeline* postproc = runtime.use_fp16() ? runtime.postproc() : runtime.postproc_f32();
    ncnn::VkMat rgba_gpu;
    ncnn::VkMat in_gpu_pre;
    ncnn::Mat tile_rgba_cpu;
    if (pre_down2) {
        // Stufe 2: full-res upload, down2 shader halves to iw x ih.
        // Stufe 3 (Zero-Copy-Upload): der Frame-Puffer wird direkt
        // gewrappt statt alloc+memcpy — record_clone kopiert beim
        // Recorden synchron ins Staging, der Puffer lebt garantiert
        // bis submit_and_wait (gleicher Scope). Keine Ownership.
        tile_rgba_cpu = ncnn::Mat(full_w, full_h,
                                  const_cast<unsigned char*>(rgba_src),
                                  (size_t)4, 1);
        rgba_gpu.create(full_w, full_h, (size_t)4, 1, runtime.blob_allocator());
        cmd.record_clone(tile_rgba_cpu, rgba_gpu, topt);
        in_gpu_pre.create(iw, ih, 3, act_elemsize, 1, runtime.blob_allocator());
        std::vector<ncnn::VkMat> binds(2);
        binds[0] = rgba_gpu;
        binds[1] = in_gpu_pre;
        std::vector<ncnn::vk_constant_type> consts(5);
        consts[0].i = full_w;
        consts[1].i = full_h;
        consts[2].i = iw;
        consts[3].i = ih;
        consts[4].i = (int)in_gpu_pre.cstep;
        ncnn::VkMat disp; disp.w = iw; disp.h = ih; disp.c = 1;
        cmd.record_pipeline(runtime.preproc_down2(), binds, consts, disp);
    } else {
    // Stufe 3 (Zero-Copy-Upload): wie oben, Frame-Puffer wrappen.
    tile_rgba_cpu = ncnn::Mat(iw, ih,
                              const_cast<unsigned char*>(rgba_src),
                              (size_t)4, 1);
    rgba_gpu.create(iw, ih, (size_t)4, 1, runtime.blob_allocator());
    if (!rgba_gpu.data) { outcome.error = "gpu upload alloc failed"; set_stage("upload"); return false; }
    cmd.record_clone(tile_rgba_cpu, rgba_gpu, topt);
    // No local re-declaration here: it would shadow the outer
    // in_gpu_pre that the extractor/srvgg path below actually uses,
    // leaving that outer mat empty (SIGFPE deep in ncnn's Padding).
    in_gpu_pre.create(iw, ih, 3, act_elemsize, 1, runtime.blob_allocator());
    if (!in_gpu_pre.data) { outcome.error = "gpu input alloc failed"; set_stage("upload"); return false; }
    // A failed preproc pipeline creation (logged at load) must fail
    // the frame, not dereference a null pipeline below. The pipelines
    // are precision-matched to the network storage mode.
    ncnn::Pipeline* preproc = runtime.use_fp16() ? runtime.preproc() : runtime.preproc_f32();
    if (!preproc || !postproc) { outcome.error = "gpu pre/postproc pipeline unavailable"; set_stage("upload"); return false; }
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
    }
    ncnn::VkMat out_gpu;
    // E4 phase 1: hand-written SRVGG kernels instead of the ncnn
    // extractor (full frames only; tiles and any srvgg failure fall
    // back to ncnn for the same frame). Postproc/download below are
    // shared: tailOut is fp16 planar exactly like extractor output.
    bool srvggServed = false;
    bool srvggAttempted = false;
    // The hand-written engine consumes/produces fp16 planar only, so
    // it is unavailable in fp32-storage mode (ncnn serves the frame).
    if (allow_srvgg && want_srvgg && runtime.use_fp16()) {
        srvggAttempted = true;
        SrvggVulkan* srvgg = runtime.ensure_srvgg();
        std::string srvggErr;
        if (srvgg->ensure(runtime.srvgg_models_dir(), srvggErr)
            && srvgg->run(cmd, in_gpu_pre, iw, ih, out_gpu, topt, srvggErr)) {
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
        ncnn::Extractor ex = runtime.net().create_extractor();
        ex.set_blob_vkallocator(runtime.blob_allocator());
        ex.set_workspace_vkallocator(runtime.blob_allocator());
        ex.set_staging_vkallocator(runtime.staging_allocator());
        ex.input("data", in_gpu_pre);
        int ret = ex.extract("output", out_gpu, cmd);
        if (ret != 0) { outcome.error = "extractor extract failed"; set_stage("upload"); return false; }
    }
    // Presentation target: exact when given (the shader picks identity,
    // box-downscale or bilinear-upscale per axis), else the network
    // output. fp32 mode can hand the postproc a target larger than the
    // (governor-reduced) network output, so do NOT clamp to out_gpu.
    const int pw = fw > 0 ? fw : out_gpu.w;
    const int ph = fh > 0 ? fh : out_gpu.h;
    ncnn::VkMat out_rgba_gpu;
    out_rgba_gpu.create(pw, ph, (size_t)4, 1, runtime.blob_allocator());
    if (!out_rgba_gpu.data) { outcome.error = "gpu output alloc failed"; set_stage("upload"); return false; }
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
    // Stufe 3 (Zero-Copy-Download): Zielvektor vorab auf pw x ph
    // bringen, der Download landet direkt drin — create_like uebernimmt den
    // Puffer bei Formgleichheit (dims=2, w=pw, h=ph, e4/u1,
    // allocator=null==blob_allocator). Fallback unten falls nicht.
    frame_out.resize(alignedFrameBytes((size_t)pw * ph * 4));
    dst = ncnn::Mat(pw, ph, frame_out.data(), (size_t)4, 1);
    cmd.record_clone(out_rgba_gpu, dst, topt);
    // Never ignore the submit result: a dead submit leaves every
    // buffer untouched (silent black frame with even alpha 0) while
    // the HTTP layer reports success. Fail loudly so the client
    // retries or falls back instead of presenting black. A failed
    // submit also voids any weight clone srvgg recorded into this
    // command: re-arm the upload whenever srvgg was involved, not
    // only when it served — a run() failure after the clone plus a
    // failed fallback submit would otherwise leave later frames
    // convolving against never-written blob memory.
    if (cmd.submit_and_wait() != 0) {
        if (srvggAttempted) runtime.srvgg()->invalidateGpuWeights();
        outcome.error = "gpu submit failed";
        set_stage("submit");
        return false;
    }
    outcome.out_w = dst.w; outcome.out_h = dst.h;
    // The download must have produced the target-sized frame: dst
    // without data (OOM on the clone) or a size the postproc never
    // promised means the bytes below would be garbage.
    if (!dst.data || outcome.out_w <= 0 || outcome.out_h <= 0
        || outcome.out_w != pw || outcome.out_h != ph) {
        outcome.error = !dst.data ? "gpu download failed" : "gpu postproc size mismatch";
        set_stage("submit");
        return false;
    }
    size_t need = (size_t)outcome.out_w * outcome.out_h * 4;
    frame_out.resize(need);
    memcpy(frame_out.data(), dst.data, need);
    return true;
}
#else
bool run_gpu_frame(GpuRuntime& runtime, const unsigned char* rgba_src,
                   int iw, int ih, int fw, int fh,
                   bool allow_srvgg, bool want_srvgg,
                   bool pre_down2, int full_w, int full_h,
                   std::vector<unsigned char>& frame_out, GpuFrameOutcome& outcome) {
    (void)runtime; (void)rgba_src; (void)iw; (void)ih; (void)fw; (void)fh;
    (void)allow_srvgg; (void)want_srvgg; (void)pre_down2; (void)full_w; (void)full_h;
    (void)frame_out;
    outcome.error = "built without Vulkan support";
    return false;
}
#endif

} // namespace aniwebscale
