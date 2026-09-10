/*
 * gpu-runtime.h — device, model, pipeline and precision lifecycle for the
 * RealESRGAN ncnn host.
 *
 * Owns the ncnn Vulkan device, the ncnn Net, the persistent blob/staging
 * allocators, the custom GPU pre/postproc pipelines (fp16 + fp32 storage),
 * the lazy hand-written SRVGG backend and the process precision policy.
 * UpscaleCore coordinates this runtime and serializes per-frame GPU access;
 * the per-frame code reaches the owned resources through the accessors.
 *
 * Lifecycle (same ordering rules as the former UpscaleCore):
 *   init_device()        — gpu instance + device selection + report
 *   load_pipeline_cache()— E6 explicit ncnn pipeline-cache load (best effort)
 *   load_models()        — net, custom pipelines, persistent allocators
 *   save_pipeline_cache()— E6 persist for the next cold start
 *   shutdown()           — srvgg + pipelines + net.clear + reclaim + destroy
 */

#pragma once

#include <cstdint>
#include <string>

#include "net.h"
#include "gpu.h"
#if NCNN_VULKAN
#include "pipelinecache.h"
#endif

namespace ncnn {
class Pipeline;
} // namespace ncnn
class SrvggVulkan;

namespace aniwebscale {

// Process configuration for load_models(); filled in by main()'s env/arg
// parsing (CLI concerns stay out of the core).
struct UpscaleCoreConfig {
    bool use_fp16 = true;
    bool use_int8 = false;
    bool use_srvgg_engine = false;
    int infer_div = 1; // Stufe 1: 1 voll, 2 infer at ceil(W/2) (Gate-PASS); Rest -> 1
    // fp32 governor tuning (see run_upscale_impl). budget 0 = disabled.
    double fp32_budget_ms = 0.0;
    double fp32_ms_per_px = 3.0e-4;
    double fp32_min_scale = 0.5;
    std::string param_path;
    std::string bin_path;
    std::string int8_param;
    std::string int8_bin;
};

class GpuRuntime {
public:
    GpuRuntime() = default;
    ~GpuRuntime() = default; // shutdown() must run before the instance dies
    GpuRuntime(const GpuRuntime&) = delete;
    GpuRuntime& operator=(const GpuRuntime&) = delete;

    // ncnn gpu instance + device selection + device report. Returns false
    // after logging when no Vulkan device is available (no teardown —
    // mirrors the original early return).
    bool init_device();

    // E6: explicit ncnn pipeline-cache load. The device compiles every
    // layer + custom pipeline on first use; loading the previous session's
    // cache hides that cold-start cost on every later spawn. Best effort,
    // never fatal. Call between init_device() and load_models().
    void load_pipeline_cache(const std::string& path, const std::string& cache_dir);

    // ncnn Net + GPU pre/postproc pipelines + persistent allocators. Returns
    // false after logging on any fatal step; the allocator-failure path tears
    // the gpu instance back down.
    bool load_models(const UpscaleCoreConfig& cfg);

    // E6: persist the device pipeline cache for the next cold start. Runs
    // after the transports stop (GPU idle, every pipeline compiled) and
    // before shutdown() (the cache dies with the device).
    void save_pipeline_cache(const std::string& path);

    // Reclaim every GPU resource in dependency order. Idempotent.
    void shutdown();

    ncnn::VulkanDevice* device() const { return device_; }
    ncnn::VkAllocator* blob_allocator() const { return blob_; }
    ncnn::VkAllocator* staging_allocator() const { return staging_; }
    uint32_t heap_budget_start_mb() const { return heap_budget_start_mb_; }

    ncnn::Net& net() { return net_; }
    bool use_fp16() const { return use_fp16_; }
    bool use_srvgg_engine() const { return use_srvgg_engine_; }
    const std::string& srvgg_models_dir() const { return srvgg_models_dir_; }
    int infer_div() const { return infer_div_; }
    double fp32_budget_ms() const { return fp32_budget_ms_; }
    double fp32_ms_per_px() const { return fp32_ms_per_px_; }
    double fp32_min_scale() const { return fp32_min_scale_; }

#if NCNN_VULKAN
    ncnn::Pipeline* postproc() const { return postproc_; }         // fp16 storage
    ncnn::Pipeline* preproc() const { return preproc_; }           // fp16 storage
    ncnn::Pipeline* postproc_f32() const { return postproc_f32_; } // fp32 storage
    ncnn::Pipeline* preproc_f32() const { return preproc_f32_; }   // fp32 storage
    ncnn::Pipeline* preproc_down2() const { return preproc_down2_; } // div2 preproc
#endif

    // Lazy hand-written SRVGG backend: created on first use (zero cost when
    // unused), never null once created. Caller must check use_fp16() first.
    SrvggVulkan* ensure_srvgg();
    SrvggVulkan* srvgg() const { return srvgg_; }

private:
    // Delete every custom pre/postproc pipeline (both precisions). Used by the
    // load-failure path and shutdown(); null-safe and idempotent.
    void destroy_pipelines();

    static void report_device(const ncnn::VulkanDevice* dev);

    ncnn::VulkanDevice* device_ = nullptr;
    ncnn::Net net_;
    ncnn::VkAllocator* blob_ = nullptr;
    ncnn::VkAllocator* staging_ = nullptr;
#if NCNN_VULKAN
    ncnn::Pipeline* postproc_ = nullptr;      // fp16 storage
    ncnn::Pipeline* preproc_ = nullptr;       // fp16 storage
    ncnn::Pipeline* postproc_f32_ = nullptr;  // fp32 storage
    ncnn::Pipeline* preproc_f32_ = nullptr;   // fp32 storage
    ncnn::Pipeline* preproc_down2_ = nullptr; // Stufe 2: div2 in-preproc downscale
#endif
    SrvggVulkan* srvgg_ = nullptr; // lazy, created on the first E4 frame
    std::string srvgg_models_dir_;
    bool use_srvgg_engine_ = false;
    bool use_fp16_ = true; // false = fp32 storage (elemsize 4 everywhere)
    int infer_div_ = 1; // Stufe 1: 1 voll, 2 halb (Rest faellt auf 1)
    // fp32 governor: target frame budget (ms), calibrated net cost (ms per
    // input pixel) and the lowest allowed inference scale. 0 budget disables
    // the governor (full-resolution fp32, used for A/B and quality gates).
    double fp32_budget_ms_ = 0.0;
    double fp32_ms_per_px_ = 3.0e-4;
    double fp32_min_scale_ = 0.5;
    uint32_t heap_budget_start_mb_ = 0;
};

} // namespace aniwebscale
