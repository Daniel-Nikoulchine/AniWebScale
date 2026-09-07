#pragma once
// E4 phase 1: hand-written Vulkan SRVGG backend (RealESR-AnimeVideo-v3_x4).
//
// Replaces ncnn's layer graph with custom conv/tail compute kernels while
// reusing everything around it: transport, blob/staging allocators, the
// proven preproc (/255 to fp16 planar) and postproc (pack + box-downscale)
// shaders. Weights come from the shipped srvgg f32 bin + JSON manifest
// (same bytes the WGSL engine and the CPU oracle validate).
//
// Current scope (phase 1a): fp32 direct convs (correctness baseline),
// fused bias+PReLU, fused CRD-shuffle/residual-add/clip tail to fp16
// planar, single-pass frames only (tiled sizes fall back to ncnn).
// Phase 1b (shared-memory tiling, oc-parallelism) gates against THIS
// implementation on the same device — no ORT needed for iteration.

#include <cstdint>
#include <string>
#include <vector>

namespace ncnn {
class Mat;
class Option;
class Pipeline;
class VkAllocator;
class VkCompute;
class VkMat;
class VulkanDevice;
} // namespace ncnn

struct SrvggConvLayer {
    int inCh = 0;
    int outCh = 0;
    int wBase = 0; // float offsets into the weights buffer
    int bBase = 0;
    int sBase = 0; // slope offset (valid when hasPrelu)
    int hasPrelu = 0;
};

class SrvggVulkan {
  public:
    SrvggVulkan(ncnn::VulkanDevice* device, ncnn::VkAllocator* blob, ncnn::VkAllocator* staging);
    ~SrvggVulkan();

    SrvggVulkan(const SrvggVulkan&) = delete;
    SrvggVulkan& operator=(const SrvggVulkan&) = delete;

    // Load weights (once per process) + create conv/tail pipelines.
    // Returns false when unavailable (caller falls back to ncnn); safe to
    // call repeatedly (second call is a no-op status check).
    bool ensure(const std::string& modelsDir, std::string& err);
    bool ready() const { return ready_; }

    // Run one single-pass frame. preprocOut is the fp16 planar [0,1] frame
    // (preproc output, cstep = frameStride). Produces fp16 planar 4x into
    // tailOut (created here, blob-pooled) for the existing postproc shader.
    // cmd/allocators follow the spike lifetime rule (one VkCompute per call,
    // owned by the caller). Returns false on any failure (caller falls back
    // to ncnn for this frame); tailOut is then untouched.
    bool run(ncnn::VkCompute& cmd, const ncnn::VkMat& preprocOut, int width, int height,
             ncnn::VkMat& tailOut, const ncnn::Option& opt, std::string& err);

    // Re-arm the one-time GPU weight upload. Called when a submit carrying
    // the recorded weight clone failed: uploadWeights() latches
    // weightsGpu_ the moment the clone is RECORDED, so without this a
    // failed submit would leave every later frame skipping the transfer
    // and convolving against never-written blob memory.
    void invalidateGpuWeights();

  private:
    bool loadWeights(const std::string& modelsDir, std::string& err);
    bool createPipelines(std::string& err);
    bool uploadWeights(ncnn::VkCompute& cmd, const ncnn::Option& opt, std::string& err);
    // Phase 1b fast path (shared-memory tiling, fp16 acts). Falls back to
    // false (caller: ncnn) on any failure, same contract as run().
    bool runTiled(ncnn::VkCompute& cmd, const ncnn::VkMat& preprocOut, int width, int height,
                  ncnn::VkMat& tailOut, const ncnn::Option& opt, std::string& err);
    // Temporary bisect: when non-null, downloads actB right after conv0
    // (in-order) for offline comparison. Env-gated, removed after.
    ncnn::Mat* debugAct0Out = nullptr;

    ncnn::VulkanDevice* device_;
    ncnn::VkAllocator* blob_;
    ncnn::VkAllocator* staging_;
    bool weightsLoaded_ = false;
    // Latched when the weight files could not be read: weights do not appear
    // mid-process, so ensure() must not re-open two missing files every frame
    // (the caller calls ensure() per frame until it succeeds).
    bool weightsUnavailable_ = false;
    bool ready_ = false;
    std::vector<SrvggConvLayer> layers_;
    ncnn::Mat* weightsCpu_ = nullptr; // lifelong CPU holder (2.5 MB)
    ncnn::VkMat* weightsGpu_ = nullptr; // lifelong GPU copy (uploaded once)
    ncnn::VkMat* dummy_ = nullptr; // valid buffer for idle input slots
    ncnn::Pipeline* convPipe_ = nullptr; // phase 1a naive (gating reference)
    ncnn::Pipeline* tiledPipe_ = nullptr; // phase 1b shared-memory + fp16
    ncnn::Pipeline* tailPipe_ = nullptr;
    // Phase selector (env ANIWEBSCALE_SRVGG_CONV=tiled|naive, default
    // tiled; naive stays the gating reference).
    bool useTiled_ = false;
};
