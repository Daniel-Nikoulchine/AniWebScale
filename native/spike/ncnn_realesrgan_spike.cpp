/*
 * AniWebScale ncnn-Vulkan spike for Real-ESRGAN realesr-animevideov3 (x4).
 *
 * Phase 1 of the Vulkan-only plan: prove that the official ncnn model artifacts
 * produce a valid 4x result on the target GPU (AMD RX 6750 XT, RADV on Linux /
 * AMDVLK-equivalent on Windows). This executable is a diagnostic, not the
 * production pipeline: it processes a single image end-to-end, logs device,
 * queue, memory, FP16 capability and per-stage timing, and writes the result as
 * PNG for the quality comparison against the ONNX reference (Phase 2).
 *
 * Pre/post processing follows xinntao/Real-ESRGAN-ncnn-vulkan v0.2.0:
 * - RGBA8 input, planar RGB floats scaled to [0,1] (the reference does this in
 *   its preproc compute shader),
 * - the graph handles border padding itself (prepadding=10 reflect semantics
 *   are baked into the official model artifacts; Conv pads are replicated),
 * - output scaled back to packed RGB8 with clamping (reference: to_pixels).
 *
 * Memory-lifetime notes, learned the hard way on RADV with ReBAR:
 * - With ReBAR the ncnn blob allocator is mappable, so the download clone
 *   (VkCompute::record_clone VkMat->Mat) allocates the host-side Mat on the
 *   device buffer itself. The output Mat must be read before the blob
 *   allocator is reclaimed, and the reclaim must happen before the GPU mats
 *   go out of scope (mirrors the reference process() ordering).
 * - ncnn::Mat::row(y) on a c>1 Mat indexes channels, not rows. Planar access
 *   must go through data + cstep offsets.
 * - The ncnn::Net and every VkMat/VkCompute touching it must be destroyed
 *   before ncnn::destroy_gpu_instance() tears down the shared device.
 *
 * Storage precision is selected with --fp16. It only packs/stores in half
 * precision (like the reference implementation's fp16s mode); arithmetic stays
 * fp32, which the quality gate (Phase 2) must confirm before any wider fp16
 * use.
 */

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_PNG
#define STBI_ONLY_JPEG
#define STB_IMAGE_STATIC
#include "stb_image.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STB_IMAGE_WRITE_STATIC
#include "stb_image_write.h"

#include "net.h"
#include "gpu.h"

namespace {

struct Options {
    const char* input_path = nullptr;
    const char* output_path = nullptr;
    const char* param_path = nullptr;
    const char* bin_path = nullptr;
    bool fp16 = false;
    int warmup_frames = 0;
    int sample_frames = 1;
};

void print_usage()
{
    fprintf(stderr,
        "Usage: ncnn-spike -i input.png -o output.png -p model.param -b model.bin [--fp16] [--warmup N] [--frames N]\n");
}

void report_device(const ncnn::VulkanDevice* device)
{
    const ncnn::GpuInfo& info = device->info;

    fprintf(stderr, "[device] name=%s\n", info.device_name());
    const uint32_t api = info.api_version();
    fprintf(stderr, "[device] api_version=%u.%u.%u driver_version=%u driver=%s\n",
        api >> 22, (api >> 12) & 0x3ff, api & 0xfff,
        info.driver_version(), info.driver_name());
    fprintf(stderr, "[device] vendor_id=0x%04x device_id=0x%04x type=%s\n",
        info.vendor_id(), info.device_id(),
        info.type() == 0 ? "discrete" : info.type() == 1 ? "integrated" : "other");
    fprintf(stderr, "[device] fp16_packed=%d fp16_storage=%d fp16_arithmetic=%d\n",
        info.support_fp16_packed(), info.support_fp16_storage(), info.support_fp16_arithmetic());
    fprintf(stderr, "[device] max_workgroup_invocations=%u compute_queues=%u unified_queues=%d rebar=%d\n",
        info.max_workgroup_invocations(), info.compute_queue_count(),
        info.unified_compute_transfer_queue(), info.resizable_bar_enabled());

    const VkPhysicalDeviceMemoryProperties& mem = info.physical_device_memory_properties();
    size_t device_local = 0;
    for (uint32_t i = 0; i < mem.memoryHeapCount; ++i)
    {
        if (mem.memoryHeaps[i].flags & VK_MEMORY_HEAP_DEVICE_LOCAL_BIT)
            device_local += (size_t)mem.memoryHeaps[i].size;
    }
    fprintf(stderr, "[device] device_local_memory=%.1f GiB\n", device_local / (1024.0 * 1024.0 * 1024.0));
}

double milliseconds_since(std::chrono::steady_clock::time_point start)
{
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
}

// Loads the model, runs the frame loop, and returns through output_rgb8.
// Everything ncnn-owned dies when this function returns, before the caller
// destroys the GPU instance.
int process_frame_loop(const Options& options, const stbi_uc* pixels, int width, int height,
    std::vector<unsigned char>& output_rgb8)
{
    ncnn::Net net;
    net.opt.use_vulkan_compute = true;
    net.opt.num_threads = 4;
    net.opt.use_fp16_packed = options.fp16;
    net.opt.use_fp16_storage = options.fp16;
    net.opt.use_fp16_arithmetic = false;
    net.opt.use_bf16_storage = false;
    net.opt.use_int8_storage = false;
    net.opt.use_int8_arithmetic = false;
    if (net.load_param(options.param_path) != 0)
    {
        fprintf(stderr, "failed to load param: %s\n", options.param_path);
        return 1;
    }
    if (net.load_model(options.bin_path) != 0)
    {
        fprintf(stderr, "failed to load model: %s\n", options.bin_path);
        return 1;
    }
    fprintf(stderr, "[model] param=%s bin=%s fp16_storage=%d\n",
        options.param_path, options.bin_path, options.fp16);

    const ncnn::VulkanDevice* device = net.vulkan_device();

    // CPU pre-processing: packed RGBA8 -> planar RGB floats in [0,1].
    // Channel-major layout with cstep floats per channel; planes are disjoint.
    ncnn::Mat input(width, height, 3, 4u, 1);
    {
        const float scale = 1.0f / 255.0f;
        float* plane_r = (float*)input.data;
        float* plane_g = plane_r + input.cstep;
        float* plane_b = plane_g + input.cstep;
        for (int y = 0; y < height; ++y)
        {
            const unsigned char* row = pixels + (size_t)y * width * 4;
            float* out_r = plane_r + (size_t)y * width;
            float* out_g = plane_g + (size_t)y * width;
            float* out_b = plane_b + (size_t)y * width;
            for (int x = 0; x < width; ++x)
            {
                out_r[x] = row[x * 4 + 0] * scale;
                out_g[x] = row[x * 4 + 1] * scale;
                out_b[x] = row[x * 4 + 2] * scale;
            }
        }
    }

    std::vector<double> frame_times;
    frame_times.reserve(options.sample_frames);
    int logged_out_w = 0;
    int logged_out_h = 0;
    const int scale = 4;
    const size_t out_width = (size_t)width * scale;
    const size_t out_height = (size_t)height * scale;
    output_rgb8.resize(out_width * out_height * 3);

    for (int frame = 0; frame < options.warmup_frames + options.sample_frames; ++frame)
    {
        const bool measure = frame >= options.warmup_frames;
        const auto frame_start = std::chrono::steady_clock::now();

        // Acquire per frame and reclaim after every GPU object below has been
        // destroyed (inner scope), mirroring the reference implementation's
        // process() ordering. Reclaiming while the VkMats still held buffers
        // crashed depending on storage precision and build type.
        ncnn::VkAllocator* blob_allocator = device->acquire_blob_allocator();
        ncnn::VkAllocator* staging_allocator = device->acquire_staging_allocator();
        if (!blob_allocator || !staging_allocator)
        {
            fprintf(stderr, "failed to acquire Vulkan allocators\n");
            return 1;
        }

        {
        ncnn::Option opt = net.opt;
        opt.blob_vkallocator = blob_allocator;
        opt.workspace_vkallocator = blob_allocator;
        opt.staging_vkallocator = staging_allocator;

        ncnn::VkCompute cmd(device);

        // Upload. With fp16 storage the graph consumes half tensors, so the
        // fp32 CPU tensor is cast once before the upload (same values the
        // reference preproc shader writes in its fp16s path).
        ncnn::Mat input_converted;
        const ncnn::Mat* upload_source = &input;
        if (options.fp16)
        {
            ncnn::cast_float32_to_float16(input, input_converted, opt);
            upload_source = &input_converted;
        }
        ncnn::VkMat input_gpu;
        input_gpu.create(width, height, 3, upload_source->elemsize, upload_source->elempack, blob_allocator);
        cmd.record_clone(*upload_source, input_gpu, opt);

        // Inference. The official artifacts expose blob names "data"/"output".
        ncnn::VkMat output_gpu;
        {
            ncnn::Extractor extractor = net.create_extractor();
            extractor.set_blob_vkallocator(blob_allocator);
            extractor.set_workspace_vkallocator(blob_allocator);
            extractor.set_staging_vkallocator(staging_allocator);
            extractor.input("data", input_gpu);
            extractor.extract("output", output_gpu, cmd);
        }

        // Download.
        ncnn::Mat output;
        cmd.record_clone(output_gpu, output, opt);
        cmd.submit_and_wait();

        // With fp16 storage the output blob is a half Mat; convert it back to
        // fp32 before reading, otherwise the planar float reads run past the
        // half-sized buffer.
        ncnn::Mat output_f32;
        const ncnn::Mat* read_source = &output;
        if (output.elemsize == 2)
        {
            ncnn::cast_float16_to_float32(output, output_f32, opt);
            read_source = &output_f32;
        }

        // CPU post-processing: planar RGB [0,1] -> packed RGB8, read before
        // the blob allocator is reclaimed (see the lifetime notes above).
        {
            logged_out_w = read_source->w;
            logged_out_h = read_source->h;
            const float* plane_r = (const float*)read_source->data;
            const float* plane_g = plane_r + read_source->cstep;
            const float* plane_b = plane_g + read_source->cstep;
            const int out_w = output.w;
            const int out_h = output.h;
            for (int y = 0; y < out_h; ++y)
            {
                unsigned char* row = output_rgb8.data() + (size_t)y * out_w * 3;
                const float* r = plane_r + (size_t)y * out_w;
                const float* g = plane_g + (size_t)y * out_w;
                const float* b = plane_b + (size_t)y * out_w;
                for (int x = 0; x < out_w; ++x)
                {
                    row[x * 3 + 0] = (unsigned char)std::round(std::min(1.0f, std::max(0.0f, r[x])) * 255.0f);
                    row[x * 3 + 1] = (unsigned char)std::round(std::min(1.0f, std::max(0.0f, g[x])) * 255.0f);
                    row[x * 3 + 2] = (unsigned char)std::round(std::min(1.0f, std::max(0.0f, b[x])) * 255.0f);
                }
            }
        }

        // The output Mat may alias the blob allocator's memory (ReBAR); its
        // data has been copied out above, so reclaiming here is safe. The GPU
        // mats and the command buffer release in their own destructors.
        }

        // Every GPU object (cmd, input_gpu, output_gpu, download Mat) is now
        // destroyed; the allocators own no outstanding buffers anymore.
        device->reclaim_blob_allocator(blob_allocator);
        device->reclaim_staging_allocator(staging_allocator);

        const double frame_ms = milliseconds_since(frame_start);
        if (measure)
            frame_times.push_back(frame_ms);
        if (frame == 0)
            fprintf(stderr, "[output] %dx%d rgb8\n", logged_out_w, logged_out_h);
    }

    if (!frame_times.empty())
    {
        std::vector<double> sorted = frame_times;
        std::sort(sorted.begin(), sorted.end());
        const double p50 = sorted[sorted.size() / 2];
        const double p95 = sorted[std::min(sorted.size() - 1, (size_t)(sorted.size() * 0.95))];
        double sum = 0.0;
        for (double value : frame_times)
            sum += value;
        fprintf(stderr, "[timing] frames=%zu mean=%.3fms p50=%.3fms p95=%.3fms\n",
            frame_times.size(), sum / frame_times.size(), p50, p95);
        fprintf(stderr, "[timing] input=%dx%d -> fps=%.2f\n", width, height,
            1000.0 / (sum / frame_times.size()));
    }
    return 0;
}

int run(const Options& options)
{
    int width = 0;
    int height = 0;
    int channels_in_file = 0;
    stbi_uc* pixels = stbi_load(options.input_path, &width, &height, &channels_in_file, 4);
    if (!pixels)
    {
        fprintf(stderr, "failed to load input image: %s\n", options.input_path);
        return 1;
    }
    fprintf(stderr, "[input] %dx%d rgba8 (%s)\n", width, height, options.input_path);

    if (ncnn::create_gpu_instance() != 0)
    {
        fprintf(stderr, "failed to create Vulkan instance\n");
        stbi_image_free(pixels);
        return 1;
    }

    const int gpu_count = ncnn::get_gpu_count();
    fprintf(stderr, "[vulkan] device_count=%d\n", gpu_count);
    if (gpu_count < 1)
    {
        fprintf(stderr, "no Vulkan compute device found\n");
        ncnn::destroy_gpu_instance();
        stbi_image_free(pixels);
        return 1;
    }
    report_device(ncnn::get_gpu_device(0));

    std::vector<unsigned char> output_rgb8;
    int result = process_frame_loop(options, pixels, width, height, output_rgb8);

    if (result == 0)
    {
        const size_t out_width = (size_t)width * 4;
        const size_t out_height = (size_t)height * 4;
        if (!stbi_write_png(options.output_path, (int)out_width, (int)out_height, 3,
                output_rgb8.data(), (int)out_width * 3))
        {
            fprintf(stderr, "failed to write output: %s\n", options.output_path);
            result = 1;
        }
        else
        {
            fprintf(stderr, "[done] wrote %s\n", options.output_path);
        }
    }

    stbi_image_free(pixels);
    ncnn::destroy_gpu_instance();
    return result;
}

} // namespace

int main(int argc, char** argv)
{
    Options options;
    for (int i = 1; i < argc; ++i)
    {
        if (strcmp(argv[i], "-i") == 0 && i + 1 < argc)
            options.input_path = argv[++i];
        else if (strcmp(argv[i], "-o") == 0 && i + 1 < argc)
            options.output_path = argv[++i];
        else if (strcmp(argv[i], "-p") == 0 && i + 1 < argc)
            options.param_path = argv[++i];
        else if (strcmp(argv[i], "-b") == 0 && i + 1 < argc)
            options.bin_path = argv[++i];
        else if (strcmp(argv[i], "--fp16") == 0)
            options.fp16 = true;
        else if (strcmp(argv[i], "--warmup") == 0 && i + 1 < argc)
            options.warmup_frames = atoi(argv[++i]);
        else if (strcmp(argv[i], "--frames") == 0 && i + 1 < argc)
            options.sample_frames = atoi(argv[++i]);
        else
        {
            print_usage();
            return 2;
        }
    }
    if (!options.input_path || !options.output_path || !options.param_path || !options.bin_path)
    {
        print_usage();
        return 2;
    }
    return run(options);
}
