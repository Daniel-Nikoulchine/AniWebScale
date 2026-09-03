/*
 * AniWebScale ncnn-Vulkan RealESRGAN Benchmark — native host GPU path only.
 *
 * Mirrors the proven spike/host Vulkan path (RADV NAVI22, fp16 storage, GPU
 * postproc) and measures end-to-end upscale time on synthetic frames. No
 * browser, no JS, no D3D11 — pure ncnn-Vulkan. Intended to verify performance
 * improvements with `--compare` semantics: run once, change code, run again,
 * compare mean/p50/p95.
 *
 * Metrics per case: mean, p50, p95, fps, rme, raw samplesMs. Optional A/B
 * compares GPU postproc vs CPU fallback on the same frames.
 *
 * Output is JSON to stdout or --output, stderr carries human summary.
 */

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>
#include <unistd.h>

#include "net.h"
#include "gpu.h"

#if NCNN_VULKAN
#include "realesrgan_spike_postproc.comp.hex.h"
#include "realesrgan_spike_preproc.comp.hex.h"
#endif

namespace {

struct BenchCase {
    int width = 0;
    int height = 0;
    const char* label = nullptr;
};

// Canonical anime frame sizes. Output is 4x.
static const BenchCase kCases[] = {
    {640, 360, "360p"},
    {960, 540, "540p"},
    {1280, 720, "720p"},
    {1920, 1080, "1080p"},
};

struct Options {
    std::string param_path;
    std::string bin_path;
    int warmup = 3;
    int samples = 30;
    std::string output_path;
    bool compare_cpu_fallback = false; // if true, also run without GPU postproc
    bool fp32_only = false;            // if true, run fp32 instead of fp16
    bool use_int8 = false;             // INT8-Experiment (ncnn-Pin post #6751)
    std::string dump_path;             // if set, write last frame RGBA8 of the first case (raw, out_w*out_h*4)
    std::vector<BenchCase> cases;
};

struct CaseResult {
    BenchCase bench_case;
    int out_w = 0;
    int out_h = 0;
    bool fp16 = true;
    bool int8 = false;
    bool gpu_postproc = true;
    double mean = 0;
    double p50 = 0;
    double p95 = 0;
    double fps = 0;
    double rme = 0;
    std::vector<double> samples;
    std::string status = "ok";
    std::string error;
};

static void print_usage(const char* prog) {
    fprintf(stderr,
        "Usage: %s --param model.param --bin model.bin [options]\n"
        "  --warmup N            warmup frames per case (default 3)\n"
        "  --samples N           measured frames per case (default 30)\n"
        "  --output FILE         write JSON report (default stdout)\n"
        "  --cases WxH[,WxH...]  e.g. 640x360,1280x720 (default all 4)\n"
        "  --compare-cpu         also run CPU fallback A/B for each case\n"
        "  --fp32                force fp32 storage (no fp16)\n"
        "  --int8                enable int8 inference (needs quantized model)\n"
        "  --dump-frame FILE     write last RGBA8 frame of the first case (raw)\n"
        "  --help\n",
        prog);
}

static std::string find_default_model(const char* def, const char* env) {
    const char* e = std::getenv(env);
    if (e && std::filesystem::exists(e)) return e;
    if (std::filesystem::exists(def)) return def;
    char exe[4096] = {};
    ssize_t n = ::readlink("/proc/self/exe", exe, sizeof(exe) - 1);
    if (n > 0) {
        std::filesystem::path p = std::filesystem::path(std::string(exe, n)).parent_path();
        for (int i = 0; i < 5; ++i) {
            auto cand = p / def;
            if (std::filesystem::exists(cand)) return cand.string();
            cand = p / "../../models/realesrgan/ncnn" / std::filesystem::path(def).filename();
            if (std::filesystem::exists(cand)) return cand.string();
            p = p.parent_path();
        }
    }
    std::string fallback = "/home/daniel/Projects/anime4kBrowser/models/realesrgan/ncnn/" +
                           std::string(std::filesystem::path(def).filename());
    if (std::filesystem::exists(fallback)) return fallback;
    return def;
}

static std::vector<BenchCase> parse_cases(const std::string& s) {
    std::vector<BenchCase> out;
    std::stringstream ss(s);
    std::string tok;
    while (std::getline(ss, tok, ',')) {
        int w = 0, h = 0;
        if (sscanf(tok.c_str(), "%dx%d", &w, &h) == 2 && w > 0 && h > 0) {
            out.push_back({w, h, nullptr});
        }
    }
    return out;
}

static std::string iso8601_utc_now() {
    auto now = std::chrono::system_clock::now();
    std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
    gmtime_r(&t, &tm);
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return buf;
}

static double percentile(std::vector<double> v, double p) {
    if (v.empty()) return 0;
    std::sort(v.begin(), v.end());
    size_t idx = (size_t)std::ceil(p * v.size()) - 1;
    if (idx >= v.size()) idx = v.size() - 1;
    return v[idx];
}

static double rme_percent(const std::vector<double>& v, double mean) {
    if (v.size() < 2 || mean == 0) return 0;
    double var = 0;
    for (double x : v) var += (x - mean) * (x - mean);
    double sd = std::sqrt(var / (v.size() - 1));
    double sem = sd / std::sqrt((double)v.size());
    // 95% CI half-width relative to mean, approximate
    return (1.96 * sem / mean) * 100.0;
}

// Generate deterministic RGBA8 gradient (same every run, no file I/O)
static std::vector<unsigned char> make_rgba(int w, int h) {
    std::vector<unsigned char> rgba((size_t)w * h * 4);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            size_t o = ((size_t)y * w + x) * 4;
            rgba[o + 0] = (unsigned char)((x * 3) & 0xff);
            rgba[o + 1] = (unsigned char)((y * 5) & 0xff);
            rgba[o + 2] = (unsigned char)(((x + y) * 7) & 0xff);
            rgba[o + 3] = 255;
        }
    }
    return rgba;
}

struct RunContext {
    ncnn::Net& net;
    ncnn::VulkanDevice* device;
    ncnn::Pipeline* postproc;
    ncnn::Pipeline* preproc;
    bool use_fp16;
    bool use_int8;
};

static bool run_one_case(const BenchCase& bc, const std::vector<unsigned char>& rgba,
                         const RunContext& ctx, bool gpu_postproc,
                         int warmup, int samples, CaseResult& out,
                         std::vector<unsigned char>* dump_rgba = nullptr) {
    out.bench_case = bc;
    out.fp16 = ctx.use_fp16;
    out.int8 = ctx.use_int8;
    out.gpu_postproc = gpu_postproc;
    int width = bc.width;
    int height = bc.height;

    // Preprocess: for GPU preproc path we keep flat RGBA8, for CPU path we keep planar
    bool use_gpu_preproc = false;
#if NCNN_VULKAN
    use_gpu_preproc = (ctx.use_fp16 && ctx.preproc != nullptr && gpu_postproc);
#endif
    ncnn::Mat input(width, height, 3, 4u, 1);
    ncnn::Mat input_conv;
    const ncnn::Mat* upload_src = &input;
    ncnn::Mat input_rgba_cpu;
    if (use_gpu_preproc) {
        input_rgba_cpu.create(width, height, (size_t)4, 1u);
        memcpy(input_rgba_cpu.data, rgba.data(), (size_t)width*height*4);
        upload_src = nullptr; // signal GPU path
    } else {
        {
            const float scale = 1.0f / 255.0f;
            float* pr = (float*)input.data;
            float* pg = pr + input.cstep;
            float* pb = pg + input.cstep;
            for (int y = 0; y < height; ++y) {
                const unsigned char* row = rgba.data() + (size_t)y * width * 4;
                float* out_r = pr + (size_t)y * width;
                float* out_g = pg + (size_t)y * width;
                float* out_b = pb + (size_t)y * width;
                for (int x = 0; x < width; ++x) {
                    out_r[x] = row[x * 4 + 0] * scale;
                    out_g[x] = row[x * 4 + 1] * scale;
                    out_b[x] = row[x * 4 + 2] * scale;
                }
            }
        }
        if (ctx.use_fp16) {
            ncnn::cast_float32_to_float16(input, input_conv, ncnn::Option());
            upload_src = &input_conv;
        }
    }

    std::vector<double> times;
    times.reserve(samples);
    int out_w = 0, out_h = 0;
    std::string err;

    // Persistent allocators: acquire once for the whole case, reuse across frames.
    // Mirrors the planned host change — avoids per-frame vkAllocate churn and
    // reduces p95 jitter. Reclaim only after the loop.
    ncnn::VkAllocator* blob = ctx.device->acquire_blob_allocator();
    ncnn::VkAllocator* staging = ctx.device->acquire_staging_allocator();
    if (!blob || !staging) {
        out.status = "error";
        out.error = "allocator_failed";
        return false;
    }
    for (int frame = 0; frame < warmup + samples; ++frame) {
        bool measure = frame >= warmup;
        auto t0 = std::chrono::steady_clock::now();
        // One VkCompute per frame: reusing a persistent VkCompute across
        // submit_and_wait() cycles SIGSEGVs inside RADV (same lifetime rule
        // as the host's run_gpu_frame in main.cpp).
        ncnn::VkCompute cmd(ctx.device);

        bool frame_ok = false;
        {
            ncnn::Option opt = ctx.net.opt;
            opt.blob_vkallocator = blob;
            opt.workspace_vkallocator = blob;
            opt.staging_vkallocator = staging;

            ncnn::VkMat in_gpu;
            ncnn::VkMat in_gpu_pre;
            ncnn::VkMat rgba_gpu;
            if (use_gpu_preproc) {
                rgba_gpu.create(width, height, (size_t)4, 1, blob);
                cmd.record_clone(input_rgba_cpu, rgba_gpu, opt);
                in_gpu_pre.create(width, height, 3, (size_t)2, 1, blob);
                {
                    std::vector<ncnn::VkMat> binds(2);
                    binds[0] = rgba_gpu;
                    binds[1] = in_gpu_pre;
                    std::vector<ncnn::vk_constant_type> consts(3);
                    consts[0].i = width;
                    consts[1].i = height;
                    consts[2].i = (int)in_gpu_pre.cstep; // real padded cstep, same as the host
                    ncnn::VkMat disp; disp.w = width; disp.h = height; disp.c = 1;
                    cmd.record_pipeline(ctx.preproc, binds, consts, disp);
                }
                in_gpu = in_gpu_pre;
            } else {
                in_gpu.create(width, height, 3, upload_src->elemsize, upload_src->elempack, blob);
                cmd.record_clone(*upload_src, in_gpu, opt);
            }

            ncnn::VkMat out_gpu;
            {
                ncnn::Extractor ex = ctx.net.create_extractor();
                ex.set_blob_vkallocator(blob);
                ex.set_workspace_vkallocator(blob);
                ex.set_staging_vkallocator(staging);
                ex.input("data", in_gpu);
                int ret = ex.extract("output", out_gpu, cmd);
                if (ret != 0) err = "extract_failed";
            }
            if (err.empty()) {
#if NCNN_VULKAN
                if (ctx.postproc && ctx.use_fp16 && gpu_postproc) {
                    ncnn::VkMat out_rgba_gpu;
                    out_rgba_gpu.create(out_gpu.w, out_gpu.h, (size_t)4, 1, blob);
                    std::vector<ncnn::VkMat> binds(2);
                    binds[0] = out_gpu;
                    binds[1] = out_rgba_gpu;
                    // p8 shader: 5 push constants (w, h, cstep, tw, th). The
                    // benchmark always requests the identity output (tw=w).
                    std::vector<ncnn::vk_constant_type> consts(5);
                    consts[0].i = out_gpu.w;
                    consts[1].i = out_gpu.h;
                    consts[2].i = out_gpu.cstep;
                    consts[3].i = out_gpu.w;
                    consts[4].i = out_gpu.h;
                    ncnn::VkMat disp; disp.w = out_gpu.w; disp.h = out_gpu.h; disp.c = 1;
                    cmd.record_pipeline(ctx.postproc, binds, consts, disp);
                    ncnn::Mat out;
                    cmd.record_clone(out_rgba_gpu, out, opt);
                    cmd.submit_and_wait();
                    out_w = out.w; out_h = out.h;
                    if (out_w != width * 4 || out_h != height * 4) err = "gpu_postproc_size_mismatch";
                    // INT8-Gate: letzten gemessenen Frame als RGBA8 sichern.
                    if (dump_rgba && err.empty() && frame == warmup + samples - 1) {
                        size_t need = (size_t)out_w * out_h * 4;
                        dump_rgba->assign((const unsigned char*)out.data,
                                          (const unsigned char*)out.data + need);
                    }
                } else
#endif
                {
                    ncnn::Mat out;
                    cmd.record_clone(out_gpu, out, opt);
                    cmd.submit_and_wait();
                    ncnn::Mat out_f32;
                    const ncnn::Mat* src = &out;
                    if (out.elemsize == 2) {
                        ncnn::cast_float16_to_float32(out, out_f32, opt);
                        src = &out_f32;
                    }
                    out_w = src->w; out_h = src->h;
                    // Touch output to ensure download completed (no extra per-pixel work beyond clamp)
                    volatile int touch = 0;
                    const float* pr = (const float*)src->data;
                    if (pr && src->cstep > 0) touch += (int)pr[0];
                    (void)touch;
                }
                if (err.empty()) frame_ok = true;
            } else {
                cmd.submit_and_wait();
            }
        }

        if (!frame_ok) break;
        auto t1 = std::chrono::steady_clock::now();
        double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
        if (measure) times.push_back(ms);
    }
    ctx.device->reclaim_blob_allocator(blob);
    ctx.device->reclaim_staging_allocator(staging);

    out.out_w = out_w;
    out.out_h = out_h;
    if (!err.empty()) {
        out.status = "error";
        out.error = err;
        return false;
    }
    if ((int)times.size() != samples) {
        out.status = "incomplete";
        out.error = "not enough samples";
        return false;
    }
    out.samples = times;
    double sum = std::accumulate(times.begin(), times.end(), 0.0);
    out.mean = sum / times.size();
    out.p50 = percentile(times, 0.5);
    out.p95 = percentile(times, 0.95);
    out.fps = 1000.0 / out.mean;
    out.rme = rme_percent(times, out.mean);
    out.status = "ok";
    return true;
}

static std::string json_escape(const std::string& s) {
    std::string o;
    o.reserve(s.size() + 8);
    for (char c : s) {
        if (c == '"') o += "\\\"";
        else if (c == '\\') o += "\\\\";
        else if (c == '\n') o += "\\n";
        else if (c == '\r') o += "\\r";
        else if (c == '\t') o += "\\t";
        else if ((unsigned char)c < 0x20) {
            char buf[7];
            snprintf(buf, sizeof(buf), "\\u%04x", (unsigned char)c);
            o += buf;
        } else o += c;
    }
    return o;
}

} // namespace

int main(int argc, char** argv) {
    Options opts;
    opts.param_path = find_default_model(DEFAULT_PARAM_PATH, "ANIWEBSCALE_NCNN_PARAM");
    opts.bin_path = find_default_model(DEFAULT_BIN_PATH, "ANIWEBSCALE_NCNN_BIN");
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--param" && i + 1 < argc) opts.param_path = argv[++i];
        else if (a == "--bin" && i + 1 < argc) opts.bin_path = argv[++i];
        else if (a == "--warmup" && i + 1 < argc) opts.warmup = std::atoi(argv[++i]);
        else if (a == "--samples" && i + 1 < argc) opts.samples = std::atoi(argv[++i]);
        else if (a == "--output" && i + 1 < argc) opts.output_path = argv[++i];
        else if (a == "--cases" && i + 1 < argc) opts.cases = parse_cases(argv[++i]);
        else if (a == "--compare-cpu") opts.compare_cpu_fallback = true;
        else if (a == "--fp32") opts.fp32_only = true;
        else if (a == "--int8") opts.use_int8 = true;
        else if (a == "--dump-frame" && i + 1 < argc) opts.dump_path = argv[++i];
        else if (a == "--help" || a == "-h") { print_usage(argv[0]); return 0; }
        else { fprintf(stderr, "unknown arg: %s\n", a.c_str()); print_usage(argv[0]); return 2; }
    }
    if (opts.cases.empty()) {
        for (auto& c : kCases) opts.cases.push_back(c);
    }
    if (opts.warmup < 0) opts.warmup = 0;
    if (opts.samples < 1) opts.samples = 1;

    fprintf(stderr, "[bench] RealESRGAN ncnn-Vulkan GPU benchmark\n");
    fprintf(stderr, "[bench] param=%s\n[bench] bin=%s\n", opts.param_path.c_str(), opts.bin_path.c_str());
    fprintf(stderr, "[bench] warmup=%d samples=%d compare_cpu=%d fp16=%d int8=%d\n",
            opts.warmup, opts.samples, opts.compare_cpu_fallback, !opts.fp32_only, opts.use_int8);

    if (ncnn::create_gpu_instance() != 0) {
        fprintf(stderr, "failed to create Vulkan instance\n");
        return 1;
    }
    if (ncnn::get_gpu_count() < 1) {
        fprintf(stderr, "no Vulkan device\n");
        ncnn::destroy_gpu_instance();
        return 1;
    }
    ncnn::VulkanDevice* device = ncnn::get_gpu_device(0);
    const auto& info = device->info;
    fprintf(stderr, "[bench] device=%s api=%u.%u.%u driver=%s fp16_packed=%d fp16_storage=%d fp16_arith=%d rebar=%d\n",
            info.device_name(),
            info.api_version() >> 22, (info.api_version() >> 12) & 0x3ff, info.api_version() & 0xfff,
            info.driver_name(),
            info.support_fp16_packed(), info.support_fp16_storage(), info.support_fp16_arithmetic(),
            info.resizable_bar_enabled());

    bool use_fp16 = !opts.fp32_only && info.support_fp16_storage();
    if (opts.fp32_only) fprintf(stderr, "[bench] forcing fp32 (requested)\n");
    else if (!info.support_fp16_storage()) fprintf(stderr, "[bench] fp16 storage not supported, falling back to fp32\n");

    // Net and pipeline must die before destroy_gpu_instance (spike lifetime rules)
    int bench_exit = 0;
    {
        ncnn::Net net;
        net.opt.use_vulkan_compute = true;
        net.opt.num_threads = 4;
        net.opt.use_fp16_packed = use_fp16;
        net.opt.use_fp16_storage = use_fp16;
        net.opt.use_fp16_arithmetic = false;
        net.opt.use_winograd_convolution = true;
        net.opt.use_bf16_storage = false;
        net.opt.use_int8_inference = opts.use_int8;
        net.opt.use_int8_storage = opts.use_int8;
        net.opt.use_int8_packed = opts.use_int8;
        net.opt.use_int8_arithmetic = opts.use_int8;

        if (net.load_param(opts.param_path.c_str()) != 0) {
            fprintf(stderr, "failed to load param %s\n", opts.param_path.c_str());
            bench_exit = 1;
        } else if (net.load_model(opts.bin_path.c_str()) != 0) {
            fprintf(stderr, "failed to load bin %s\n", opts.bin_path.c_str());
            bench_exit = 1;
        } else {
            fprintf(stderr, "[bench] model loaded\n");

#if NCNN_VULKAN
            ncnn::Pipeline* postproc = nullptr;
            ncnn::Pipeline* preproc = nullptr;
            if (use_fp16) {
                postproc = new ncnn::Pipeline(device);
                postproc->set_optimal_local_size_xyz(32, 32, 1);
                std::vector<ncnn::vk_specialization_type> specs(1);
                specs[0].i = 0;
                if (postproc->create(realesrgan_spike_postproc_comp_data,
                                     sizeof(realesrgan_spike_postproc_comp_data), specs) != 0) {
                    fprintf(stderr, "[bench] failed to create postproc pipeline, will use CPU fallback\n");
                    delete postproc;
                    postproc = nullptr;
                } else {
                    fprintf(stderr, "[bench] GPU postproc ready\n");
                }
                preproc = new ncnn::Pipeline(device);
                preproc->set_optimal_local_size_xyz(32, 32, 1);
                std::vector<ncnn::vk_specialization_type> pre_specs(1);
                pre_specs[0].i = 0;
                if (preproc->create(realesrgan_spike_preproc_comp_data,
                                     sizeof(realesrgan_spike_preproc_comp_data), pre_specs) != 0) {
                    fprintf(stderr, "[bench] failed to create preproc pipeline, will use CPU fallback\n");
                    delete preproc;
                    preproc = nullptr;
                } else {
                    fprintf(stderr, "[bench] GPU preproc ready\n");
                }
            }
#else
            ncnn::Pipeline* postproc = nullptr;
            ncnn::Pipeline* preproc = nullptr;
#endif

            RunContext ctx{net, device, postproc, preproc, use_fp16, opts.use_int8};

            auto bench_start = std::chrono::steady_clock::now();
            std::vector<CaseResult> results;
            std::vector<CaseResult> cpu_results;

            for (size_t ci = 0; ci < opts.cases.size(); ++ci) {
                auto& bc = opts.cases[ci];
                fprintf(stderr, "[bench] case %dx%d ... ", bc.width, bc.height);
                fflush(stderr);
                auto rgba = make_rgba(bc.width, bc.height);
                CaseResult r;
                // Dump nur beim ersten Case (INT8-Gate vergleicht einen Frame).
                std::vector<unsigned char> dump;
                std::vector<unsigned char>* dump_ptr =
                    (!opts.dump_path.empty() && ci == 0) ? &dump : nullptr;
                bool ok = run_one_case(bc, rgba, ctx, true, opts.warmup, opts.samples, r, dump_ptr);
                if (ok) fprintf(stderr, "gpu %.1f ms p50 %.1f p95 %.1f fps %.1f\n", r.mean, r.p50, r.p95, r.fps);
                else fprintf(stderr, "gpu FAILED %s\n", r.error.c_str());
                results.push_back(r);
                if (dump_ptr && ok && !dump.empty()) {
                    std::ofstream df(opts.dump_path, std::ios::binary);
                    if (!df) fprintf(stderr, "[bench] failed to open dump %s\n", opts.dump_path.c_str());
                    else {
                        df.write((const char*)dump.data(), (std::streamsize)dump.size());
                        fprintf(stderr, "[bench] frame dump %dx%d (%zu bytes) -> %s\n",
                                r.out_w, r.out_h, dump.size(), opts.dump_path.c_str());
                    }
                }

                if (opts.compare_cpu_fallback) {
                    CaseResult rc;
                    bool ok2 = run_one_case(bc, rgba, ctx, false, opts.warmup, opts.samples, rc);
                    if (ok2) fprintf(stderr, "[bench]   cpu %.1f ms p50 %.1f (%.0f%% slower)\n",
                                     rc.mean, rc.p50, (rc.mean / r.mean - 1) * 100);
                    else fprintf(stderr, "[bench]   cpu FAILED %s\n", rc.error.c_str());
                    cpu_results.push_back(rc);
                }
            }

            double elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - bench_start).count();

            std::ostringstream json;
            json << "{\n";
            json << "  \"benchmark\": \"RealESRGAN ncnn-Vulkan " << (use_fp16 ? "fp16" : "fp32") << "\",\n";
            json << "  \"generatedAtUtc\": \"" << iso8601_utc_now() << "\",\n";
            json << "  \"device\": {\n";
            json << "    \"name\": \"" << json_escape(info.device_name()) << "\",\n";
            json << "    \"driver\": \"" << json_escape(info.driver_name()) << "\",\n";
            json << "    \"apiVersion\": \"" << (info.api_version() >> 22) << "." << ((info.api_version() >> 12) & 0x3ff) << "." << (info.api_version() & 0xfff) << "\",\n";
            json << "    \"vendorId\": " << info.vendor_id() << ",\n";
            json << "    \"deviceId\": " << info.device_id() << ",\n";
            json << "    \"fp16Packed\": " << (info.support_fp16_packed() ? "true" : "false") << ",\n";
            json << "    \"fp16Storage\": " << (info.support_fp16_storage() ? "true" : "false") << ",\n";
            json << "    \"fp16Arithmetic\": " << (info.support_fp16_arithmetic() ? "true" : "false") << ",\n";
            json << "    \"rebar\": " << (info.resizable_bar_enabled() ? "true" : "false") << "\n";
            json << "  },\n";
            json << "  \"model\": {\n";
            json << "    \"param\": \"" << json_escape(opts.param_path) << "\",\n";
            json << "    \"bin\": \"" << json_escape(opts.bin_path) << "\"\n";
            json << "  },\n";
            json << "  \"config\": {\n";
            json << "    \"warmupFrames\": " << opts.warmup << ",\n";
            json << "    \"sampleFrames\": " << opts.samples << ",\n";
            json << "    \"useFp16\": " << (use_fp16 ? "true" : "false") << ",\n";
            json << "    \"useInt8\": " << (opts.use_int8 ? "true" : "false") << ",\n";
            json << "    \"gpuPostproc\": " << (postproc ? "true" : "false") << ",\n";
            json << "    \"compareCpuFallback\": " << (opts.compare_cpu_fallback ? "true" : "false") << "\n";
            json << "  },\n";
            json << "  \"elapsedSeconds\": " << std::fixed << std::setprecision(6) << elapsed << ",\n";
            json << "  \"cases\": [\n";
            for (size_t i = 0; i < results.size(); ++i) {
                auto& r = results[i];
                json << "    {\n";
                json << "      \"width\": " << r.bench_case.width << ",\n";
                json << "      \"height\": " << r.bench_case.height << ",\n";
                json << "      \"label\": \"" << (r.bench_case.label ? r.bench_case.label : "") << "\",\n";
                json << "      \"outWidth\": " << r.out_w << ",\n";
                json << "      \"outHeight\": " << r.out_h << ",\n";
                json << "      \"fp16\": " << (r.fp16 ? "true" : "false") << ",\n";
                json << "      \"int8\": " << (r.int8 ? "true" : "false") << ",\n";
                json << "      \"gpuPostproc\": " << (r.gpu_postproc ? "true" : "false") << ",\n";
                json << "      \"averageMs\": " << std::fixed << std::setprecision(6) << r.mean << ",\n";
                json << "      \"p50Ms\": " << r.p50 << ",\n";
                json << "      \"p95Ms\": " << r.p95 << ",\n";
                json << "      \"fps\": " << r.fps << ",\n";
                json << "      \"rme\": " << r.rme << ",\n";
                json << "      \"status\": \"" << r.status << "\"";
                if (!r.error.empty()) json << ",\n      \"error\": \"" << json_escape(r.error) << "\"";
                else json << ",";
                json << "\n      \"samplesMs\": [";
                for (size_t j = 0; j < r.samples.size(); ++j) {
                    if (j) json << ", ";
                    json << std::fixed << std::setprecision(4) << r.samples[j];
                }
                json << "]\n";
                if (opts.compare_cpu_fallback && i < cpu_results.size()) {
                    auto& c = cpu_results[i];
                    json << "      ,\"cpuFallback\": {\n";
                    json << "        \"averageMs\": " << c.mean << ",\n";
                    json << "        \"p50Ms\": " << c.p50 << ",\n";
                    json << "        \"p95Ms\": " << c.p95 << ",\n";
                    json << "        \"fps\": " << c.fps << ",\n";
                    json << "        \"status\": \"" << c.status << "\"";
                    if (!c.error.empty()) json << ",\n        \"error\": \"" << json_escape(c.error) << "\"\n";
                    else json << ",\n";
                    json << "        \"samplesMs\": [";
                    for (size_t j = 0; j < c.samples.size(); ++j) {
                        if (j) json << ", ";
                        json << std::fixed << std::setprecision(4) << c.samples[j];
                    }
                    json << "]\n      }\n";
                }
                json << "    }" << (i + 1 < results.size() ? "," : "") << "\n";
            }
            json << "  ]\n";
            json << "}\n";

            std::string out = json.str();
            if (!opts.output_path.empty()) {
                std::filesystem::path p(opts.output_path);
                if (!p.parent_path().empty()) {
                    std::error_code ec;
                    std::filesystem::create_directories(p.parent_path(), ec);
                    if (ec) fprintf(stderr, "warning: cannot create %s: %s\n", p.parent_path().c_str(), ec.message().c_str());
                }
                std::ofstream f(p);
                if (!f) { fprintf(stderr, "failed to open %s\n", opts.output_path.c_str()); }
                else { f << out; fprintf(stderr, "[bench] JSON written to %s\n", opts.output_path.c_str()); }
            } else {
                fwrite(out.c_str(), 1, out.size(), stdout);
                fflush(stdout);
            }

            fprintf(stderr, "\n[bench] summary:\n");
            for (auto& r : results) {
                fprintf(stderr, "  %4dx%-4d (%s) %s: %.1f ms p50 %.1f p95 %.1f fps %.1f rme %.1f%%\n",
                        r.bench_case.width, r.bench_case.height,
                        r.bench_case.label ? r.bench_case.label : "",
                        r.gpu_postproc ? "gpu" : "cpu",
                        r.mean, r.p50, r.p95, r.fps, r.rme);
            }

            bench_exit = std::all_of(results.begin(), results.end(),
                                     [](auto& r){ return r.status == "ok"; }) ? 0 : 1;
#if NCNN_VULKAN
            delete postproc;
            delete preproc;
#endif
        }
    }
    ncnn::destroy_gpu_instance();
    return bench_exit;
}
