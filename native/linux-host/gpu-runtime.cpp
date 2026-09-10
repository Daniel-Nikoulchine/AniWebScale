/*
 * gpu-runtime.cpp — see gpu-runtime.h. The bodies are moved byte-for-byte
 * out of the former UpscaleCore (deep-module refactor), including the
 * pipeline-creation and teardown ordering rules.
 */

#include "gpu-runtime.h"

#include <cstdio>
#include <filesystem>
#include <vector>

#include "srvgg-vulkan.h"

#if NCNN_VULKAN
#include "realesrgan_spike_postproc.comp.hex.h"
#include "realesrgan_spike_preproc.comp.hex.h"
#include "realesrgan_spike_preproc_f32.comp.hex.h"
#include "realesrgan_spike_postproc_f32.comp.hex.h"
#include "realesrgan_spike_preproc_down2.comp.hex.h"
#endif

namespace aniwebscale {

bool GpuRuntime::init_device() {
    ncnn::create_gpu_instance();
    device_ = ncnn::get_gpu_device(0);
    if (!device_) {
        fprintf(stderr, "[host] no Vulkan device\n");
        return false;
    }
    report_device(device_);
    // Zombie-Hypothese (2.9.) ist belegter VRAM durch den persistenten
    // Blob-Pool: Budget jetzt loggen, am Idle-Exit nochmal, dann weiß man es.
    heap_budget_start_mb_ = device_->get_heap_budget();
    return true;
}

void GpuRuntime::load_pipeline_cache(const std::string& path, const std::string& cache_dir) {
    try {
        std::filesystem::create_directories(cache_dir);
#if NCNN_VULKAN
        const ncnn::PipelineCache* pipeline_cache = device_->get_pipeline_cache();
        if (pipeline_cache) {
            FILE* cache_in = fopen(path.c_str(), "rb");
            if (cache_in) {
                const int rc = pipeline_cache->load_cache(cache_in);
                fclose(cache_in);
                fprintf(stderr, "[host] pipeline cache %s: %s (rc=%d)\n",
                        rc == 0 ? "loaded" : "rejected",
                        path.c_str(), rc);
            } else {
                fprintf(stderr, "[host] no pipeline cache yet: %s\n", path.c_str());
            }
        }
#else
        (void)path;
#endif
    } catch (...) {}
}

bool GpuRuntime::load_models(const UpscaleCoreConfig& cfg) {
    use_srvgg_engine_ = cfg.use_srvgg_engine;
    // fp32-storage mode: the network, preproc and postproc all run with
    // 32-bit channels (elemsize 4) instead of fp16 storage (elemsize 2).
    // ~2.5x slower on NAVI22 but numerically exact; the hand-written srvgg
    // engine is fp16-only and is disabled for the whole process here.
    use_fp16_ = cfg.use_fp16;
    if (!use_fp16_) fprintf(stderr, "[host] fp32 storage mode (no fp16)\n");
    // Stufe 1: nur div=2 freigegeben (Gate 30.4 dB PASS); alles andere -> 1.
    infer_div_ = (cfg.infer_div == 2) ? 2 : 1;
    if (infer_div_ != 1) fprintf(stderr, "[host] infer-div=%d (Stufe 1)\n", infer_div_);
    fp32_budget_ms_ = cfg.fp32_budget_ms;
    fp32_ms_per_px_ = cfg.fp32_ms_per_px > 0 ? cfg.fp32_ms_per_px : 3.0e-4;
    fp32_min_scale_ = cfg.fp32_min_scale > 0 ? cfg.fp32_min_scale : 0.5;
    if (!use_fp16_ && fp32_budget_ms_ > 0)
        fprintf(stderr, "[host] fp32 governor: budget=%.1fms cost=%.2e ms/px minscale=%.2f\n",
                fp32_budget_ms_, fp32_ms_per_px_, fp32_min_scale_);

    net_.opt.use_vulkan_compute = true;
    net_.opt.num_threads = 4;
    net_.opt.use_fp16_packed = cfg.use_fp16;
    net_.opt.use_fp16_storage = cfg.use_fp16;
    net_.opt.use_fp16_arithmetic = false;
    net_.opt.use_winograd_convolution = true;
    net_.opt.use_bf16_storage = false;
    // INT8-Pfad (nur mit quantisiertem Modell, sonst stiller Fallback auf
    // fp32-Layer — deshalb oben fail-fast ohne int8-Dateien).
    net_.opt.use_int8_inference = cfg.use_int8;
    net_.opt.use_int8_storage = cfg.use_int8;
    net_.opt.use_int8_packed = cfg.use_int8;
    net_.opt.use_int8_arithmetic = cfg.use_int8;

    const std::string& load_param = cfg.use_int8 ? cfg.int8_param : cfg.param_path;
    const std::string& load_bin = cfg.use_int8 ? cfg.int8_bin : cfg.bin_path;
    if (net_.load_param(load_param.c_str()) != 0) {
        fprintf(stderr, "[host] failed to load param %s\n", load_param.c_str());
        return false;
    }
    if (net_.load_model(load_bin.c_str()) != 0) {
        fprintf(stderr, "[host] failed to load bin %s\n", load_bin.c_str());
        return false;
    }
    fprintf(stderr, "[host] model loaded\n");

#if NCNN_VULKAN
    if (cfg.use_fp16) {
        postproc_ = new ncnn::Pipeline(device_);
        postproc_->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> specs(1);
        specs[0].i = 0;
        if (postproc_->create(realesrgan_spike_postproc_comp_data, sizeof(realesrgan_spike_postproc_comp_data), specs) != 0) {
            fprintf(stderr, "[host] failed to create postproc pipeline\n");
            delete postproc_;
            postproc_ = nullptr;
        } else {
            fprintf(stderr, "[host] GPU postproc ready\n");
        }
        // Preproc: RGBA8 -> planar fp16, avoids CPU loop + CPU cast
        preproc_ = new ncnn::Pipeline(device_);
        preproc_->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> pre_specs(1);
        pre_specs[0].i = 0;
        if (preproc_->create(realesrgan_spike_preproc_comp_data, sizeof(realesrgan_spike_preproc_comp_data), pre_specs) != 0) {
            fprintf(stderr, "[host] failed to create preproc pipeline\n");
            delete preproc_;
            preproc_ = nullptr;
        } else {
            fprintf(stderr, "[host] GPU preproc ready\n");
        }
        // Stufe 2: down2 preproc (div2 box-downscale folded into preproc,
        // one dispatch, full-res upload). Null => CPU-loop fallback.
        preproc_down2_ = new ncnn::Pipeline(device_);
        preproc_down2_->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> down2_specs(1);
        down2_specs[0].i = 0;
        if (preproc_down2_->create(realesrgan_spike_preproc_down2_comp_data,
                                   sizeof(realesrgan_spike_preproc_down2_comp_data),
                                   down2_specs) != 0) {
            fprintf(stderr, "[host] failed to create preproc_down2 pipeline, div2 stays on CPU pre\n");
            delete preproc_down2_;
            preproc_down2_ = nullptr;
        } else {
            fprintf(stderr, "[host] GPU preproc_down2 ready\n");
        }
    } else {
        // fp32-storage pipelines: same layout and push constants as the
        // fp16 shaders, 32-bit channel type. No down2 variant — the
        // infer-div=2 CPU box pass feeds the small frame to the fp32
        // preproc (the down2 shader is an fp16-only optimization).
        postproc_f32_ = new ncnn::Pipeline(device_);
        postproc_f32_->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> specs(1);
        specs[0].i = 0;
        if (postproc_f32_->create(realesrgan_spike_postproc_f32_comp_data,
                                  sizeof(realesrgan_spike_postproc_f32_comp_data), specs) != 0) {
            fprintf(stderr, "[host] failed to create fp32 postproc pipeline\n");
            delete postproc_f32_;
            postproc_f32_ = nullptr;
        } else {
            fprintf(stderr, "[host] GPU fp32 postproc ready\n");
        }
        preproc_f32_ = new ncnn::Pipeline(device_);
        preproc_f32_->set_optimal_local_size_xyz(32, 32, 1);
        std::vector<ncnn::vk_specialization_type> pre_specs(1);
        pre_specs[0].i = 0;
        if (preproc_f32_->create(realesrgan_spike_preproc_f32_comp_data,
                                 sizeof(realesrgan_spike_preproc_f32_comp_data), pre_specs) != 0) {
            fprintf(stderr, "[host] failed to create fp32 preproc pipeline\n");
            delete preproc_f32_;
            preproc_f32_ = nullptr;
        } else {
            fprintf(stderr, "[host] GPU fp32 preproc ready\n");
        }
    }
#endif

    // E4 phase 1: srvgg backend is fully lazy (zero cost when unused or
    // disabled): created on the first E4 frame, weights + pipelines then.
    srvgg_models_dir_ =
        std::filesystem::path(cfg.bin_path).parent_path().parent_path().string();
    if (cfg.use_srvgg_engine) {
        fprintf(stderr, "[srvgg] engine enabled (env ANIWEBSCALE_SRVGG_ENGINE), models dir %s\n",
                srvgg_models_dir_.c_str());
    }

    // Persistent Vulkan allocators — acquired once, reused for every frame.
    // Avoids per-frame vkAllocate churn and mirrors benchmark S2 change.
    blob_ = device_->acquire_blob_allocator();
    staging_ = device_->acquire_staging_allocator();
    if (!blob_ || !staging_) {
        fprintf(stderr, "[host] failed to acquire Vulkan allocators\n");
        destroy_pipelines();
        // Same ordering rule as shutdown(): the Net must release its GPU
        // resources BEFORE the instance dies, or ~Net() SIGSEGVs later in
        // the driver. (Latent since HEAD — the failure path skipped it.)
        // Reclaim only after every user is gone (see shutdown()).
        net_.clear();
        if (blob_) device_->reclaim_blob_allocator(blob_);
        if (staging_) device_->reclaim_staging_allocator(staging_);
        blob_ = nullptr;
        staging_ = nullptr;
        ncnn::destroy_gpu_instance();
        device_ = nullptr;
        return false;
    }
    fprintf(stderr, "[host] persistent allocators ready (blob=%p staging=%p)\n", (void*)blob_, (void*)staging_);
    return true;
}

void GpuRuntime::save_pipeline_cache(const std::string& path) {
#if NCNN_VULKAN
    const ncnn::PipelineCache* pipeline_cache = device_->get_pipeline_cache();
    if (pipeline_cache) {
        FILE* cache_out = fopen(path.c_str(), "wb");
        if (cache_out) {
            const int rc = pipeline_cache->save_cache(cache_out);
            fclose(cache_out);
            fprintf(stderr, "[host] pipeline cache saved: %s (rc=%d)\n",
                    path.c_str(), rc);
        } else {
            fprintf(stderr, "[host] pipeline cache save failed: %s\n", path.c_str());
        }
    }
#else
    (void)path;
#endif
}

void GpuRuntime::shutdown() {
    // Order matters (same rule as net_.clear() vs destroy_gpu_instance
    // below): every GPU-resource owner dies BEFORE its allocators are
    // reclaimed. Reclaiming first and then deleting srvgg_ (VkMats
    // backed by the blob pool) or clearing the Net frees memory back
    // into a reclaimed pool.
#if NCNN_VULKAN
    delete srvgg_;
    srvgg_ = nullptr;
    destroy_pipelines();
#endif
    // Lifetime rule from the spike: the Net must release its GPU resources
    // BEFORE the instance dies. net.clear() destroys the layers now, while
    // the instance is still alive; the empty Net destructor afterwards is
    // a no-op.
    net_.clear();
    if (blob_) { device_->reclaim_blob_allocator(blob_); blob_ = nullptr; }
    if (staging_) { device_->reclaim_staging_allocator(staging_); staging_ = nullptr; }
    ncnn::destroy_gpu_instance();
    device_ = nullptr;
}

SrvggVulkan* GpuRuntime::ensure_srvgg() {
    if (!srvgg_) srvgg_ = new SrvggVulkan(device_, blob_, staging_);
    return srvgg_;
}

void GpuRuntime::destroy_pipelines() {
#if NCNN_VULKAN
    delete postproc_; postproc_ = nullptr;
    delete postproc_f32_; postproc_f32_ = nullptr;
    delete preproc_; preproc_ = nullptr;
    delete preproc_f32_; preproc_f32_ = nullptr;
    delete preproc_down2_; preproc_down2_ = nullptr;
#endif
}

void GpuRuntime::report_device(const ncnn::VulkanDevice* dev) {
    const auto& info = dev->info;
    fprintf(stderr, "[host] device=%s api=%u.%u.%u driver=%s fp16_packed=%d fp16_storage=%d fp16_arith=%d rebar=%d\n",
        info.device_name(),
        info.api_version() >> 22, (info.api_version() >> 12) & 0x3ff, info.api_version() & 0xfff,
        info.driver_name(),
        info.support_fp16_packed(), info.support_fp16_storage(), info.support_fp16_arithmetic(),
        info.resizable_bar_enabled());
}

} // namespace aniwebscale
