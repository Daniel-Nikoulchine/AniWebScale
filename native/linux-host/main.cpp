/*
 * AniWebScale Linux ncnn-Vulkan Native Host
 *
 * Standalone Native Messaging host for Real-ESRGAN AnimeVideo v3 (x4) on Linux.
 * Mirrors the spike's proven Vulkan path (RADV NAVI22, fp16 storage, GPU postproc)
 * but as a persistent stdin/stdout service: the browser sends framed JSON with
 * RGBA8, the host returns 4x RGBA8. No window capture, no D3D11, no named pipe.
 *
 * Framing: 4-byte little-endian length prefix + UTF-8 JSON (Chrome/Firefox spec).
 * Logging goes to stderr, stdout is strictly framed.
 *
 * Structure: main() only parses args, builds the aniwebscale::UpscaleCore
 * (upscale-core.h — Vulkan device, ncnn models, pipelines, allocators, per-frame
 * upscale) and wires the two transports (framed stdin/stdout JSON below, loopback
 * HTTP in http-transport.h) to it. Everything else lives in file-local helpers:
 * base64, framed I/O, CPU affinity/nice, governor diagnostics, pipeline-cache
 * path handling, the --traffic-test probe and shm file I/O.
 */

#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <string>
#include <vector>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <errno.h>
#include <sched.h>
#include <sys/resource.h>
#include <thread>
#include <mutex>
#include <atomic>
#include <condition_variable>
#include <random>

#include "anime4k/json.hpp"
#include "net.h"
#include "gpu.h"
#include "http-transport.h"
#include "upscale-core.h"
#include "srvgg-vulkan.h"

#if NCNN_VULKAN
#include "srvgg_traffic.comp.hex.h"
#endif

// ---------- base64 ----------
// Fast table-driven Base64 (scalar, ~2.5x faster than branchy version).
// Kept header-only to avoid external deps; AVX2 path can be added later.
// For true zero-copy the SharedMem transport (S5b) removes base64 entirely.
static const char* b64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static const int8_t b64_dec_table[256] = {
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
    52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
    -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
    15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
    -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
    41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1
};

static std::string base64_encode(const unsigned char* data, size_t len) {
    std::string out;
    out.reserve(((len + 2) / 3) * 4);
    size_t i = 0;
    // Process 3 bytes at a time without per-byte branches
    for (; i + 2 < len; i += 3) {
        uint32_t triple = (uint32_t(data[i]) << 16) | (uint32_t(data[i+1]) << 8) | uint32_t(data[i+2]);
        out.push_back(b64_chars[(triple >> 18) & 63]);
        out.push_back(b64_chars[(triple >> 12) & 63]);
        out.push_back(b64_chars[(triple >> 6) & 63]);
        out.push_back(b64_chars[triple & 63]);
    }
    size_t rem = len - i;
    if (rem == 1) {
        uint32_t triple = uint32_t(data[i]) << 16;
        out.push_back(b64_chars[(triple >> 18) & 63]);
        out.push_back(b64_chars[(triple >> 12) & 63]);
        out.push_back('=');
        out.push_back('=');
    } else if (rem == 2) {
        uint32_t triple = (uint32_t(data[i]) << 16) | (uint32_t(data[i+1]) << 8);
        out.push_back(b64_chars[(triple >> 18) & 63]);
        out.push_back(b64_chars[(triple >> 12) & 63]);
        out.push_back(b64_chars[(triple >> 6) & 63]);
        out.push_back('=');
    }
    return out;
}

static bool base64_decode(const std::string& in, std::vector<unsigned char>& out) {
    out.clear();
    out.reserve(in.size() * 3 / 4);
    size_t len = in.size();
    // Fast path: process 4 chars at a time using table
    size_t i = 0;
    // Skip leading whitespace (rare for our JSON)
    // Main loop — 4 chars -> 3 bytes
    for (; i + 3 < len; ) {
        // Skip whitespace inline
        int8_t d0 = b64_dec_table[(unsigned char)in[i]];
        int8_t d1 = b64_dec_table[(unsigned char)in[i+1]];
        int8_t d2 = b64_dec_table[(unsigned char)in[i+2]];
        int8_t d3 = b64_dec_table[(unsigned char)in[i+3]];
        // Handle padding / whitespace
        if (d0 < 0 || d1 < 0) {
            // whitespace or invalid
            if (in[i] == '=' ) break;
            if (in[i]=='\n' || in[i]=='\r' || in[i]==' ' || in[i]=='\t') { ++i; continue; }
            if (d0 < 0 || d1 < 0) return false;
        }
        if (d2 < 0) {
            if (in[i+2] == '=') {
                // 1 byte left: 2 chars + ==
                if (d0 <0 || d1 <0) return false;
                uint32_t triple = (uint32_t(d0) << 18) | (uint32_t(d1) << 12);
                out.push_back((triple >> 16) & 0xFF);
                return true;
            }
            if (in[i+2]=='\n' || in[i+2]=='\r' || in[i+2]==' ' || in[i+2]=='\t') { ++i; continue; }
            return false;
        }
        if (d3 < 0) {
            if (in[i+3] == '=') {
                // 2 bytes left: 3 chars + =
                uint32_t triple = (uint32_t(d0) << 18) | (uint32_t(d1) << 12) | (uint32_t(d2) << 6);
                out.push_back((triple >> 16) & 0xFF);
                out.push_back((triple >> 8) & 0xFF);
                return true;
            }
            if (in[i+3]=='\n' || in[i+3]=='\r' || in[i+3]==' ' || in[i+3]=='\t') { ++i; continue; }
            return false;
        }
        uint32_t triple = (uint32_t(d0) << 18) | (uint32_t(d1) << 12) | (uint32_t(d2) << 6) | uint32_t(d3);
        out.push_back((triple >> 16) & 0xFF);
        out.push_back((triple >> 8) & 0xFF);
        out.push_back(triple & 0xFF);
        i += 4;
    }
    // Tail (remaining <4 chars) — use bitstream method
    int val = 0, valb = -8;
    for (; i < len; ++i) {
        unsigned char c = (unsigned char)in[i];
        if (c == '=') break;
        int8_t d = b64_dec_table[c];
        if (d == -1) {
            if (c=='\n' || c=='\r' || c==' ' || c=='\t') continue;
            return false;
        }
        val = (val << 6) | d;
        valb += 6;
        if (valb >= 0) {
            out.push_back((val >> valb) & 0xFF);
            valb -= 8;
        }
    }
    return true;
}

// ---------- framed I/O ----------
static bool read_exact(int fd, void* buf, size_t n) {
    auto* p = static_cast<char*>(buf);
    size_t off = 0;
    while (off < n) {
        ssize_t r = ::read(fd, p + off, n - off);
        if (r == 0) return false; // EOF
        if (r < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        off += r;
    }
    return true;
}
static bool write_exact(int fd, const void* buf, size_t n) {
    auto* p = static_cast<const char*>(buf);
    size_t off = 0;
    while (off < n) {
        ssize_t w = ::write(fd, p + off, n - off);
        if (w <= 0) {
            if (w < 0 && errno == EINTR) continue;
            return false;
        }
        off += w;
    }
    return true;
}
static bool read_framed(std::string& payload) {
    uint32_t len = 0;
    if (!read_exact(STDIN_FILENO, &len, 4)) return false;
    // little endian
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    len = __builtin_bswap32(len);
#endif
    if (len > 100 * 1024 * 1024) {
        fprintf(stderr, "[host] framed message too large: %u\n", len);
        return false;
    }
    payload.resize(len);
    if (len == 0) return true;
    return read_exact(STDIN_FILENO, payload.data(), len);
}
static bool write_framed(const std::string& payload) {
    uint32_t len = payload.size();
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    uint32_t le = __builtin_bswap32(len);
    if (!write_exact(STDOUT_FILENO, &le, 4)) return false;
#else
    if (!write_exact(STDOUT_FILENO, &len, 4)) return false;
#endif
    if (len == 0) return true;
    return write_exact(STDOUT_FILENO, payload.data(), len);
}

using anime4k::json::Value;
using anime4k::json::Object;

static std::string get_string(const Object& o, const char* key, const std::string& def = "") {
    auto it = o.find(key);
    if (it == o.end()) return def;
    auto* s = it->second.as_string();
    return s ? *s : def;
}
static double get_number(const Object& o, const char* key, double def = 0) {
    auto it = o.find(key);
    if (it == o.end()) return def;
    auto n = it->second.as_number();
    return n ? *n : def;
}

// ---------- framed error JSON ----------
// All error objects share the same shape; only the invalid_json error (no
// requestId field yet) stays hand-built in the main loop. Code strings and
// messages are wire protocol — do not change.
static std::string error_json(const std::string& requestId, const char* code, const std::string& message) {
    Object err;
    err["type"] = Value("error");
    err["protocolVersion"] = Value(3.0);
    err["requestId"] = Value(requestId);
    err["code"] = Value(code);
    err["message"] = Value(message);
    err["recoverable"] = Value(true);
    return anime4k::json::stringify(Value(err));
}

// ---------- shm file I/O ----------
// Read w*h*4 bytes of RGBA8 from a shm file path. On failure fills err_code /
// err_msg with the wire-level error identity.
static bool read_shm_rgba(const std::string& path, size_t need,
                          std::vector<unsigned char>& rgba,
                          const char*& err_code, std::string& err_msg) {
    int fd = ::open(path.c_str(), O_RDONLY);
    if (fd < 0) {
        err_code = "shm_open_failed";
        err_msg = std::string("failed to open shmIn: ") + strerror(errno);
        return false;
    }
    rgba.resize(need);
    size_t off = 0;
    while (off < need) {
        ssize_t r = ::read(fd, rgba.data()+off, need-off);
        if (r <= 0) {
            if (r < 0 && errno == EINTR) continue;
            break;
        }
        off += r;
    }
    ::close(fd);
    if (off != need) {
        err_code = "shm_read_failed";
        err_msg = "shmIn size mismatch";
        return false;
    }
    return true;
}

// Write a result frame to a shm file path. On failure fills err_code / err_msg.
static bool write_shm_rgba(const std::string& path, const std::vector<unsigned char>& rgba,
                           const char*& err_code, std::string& err_msg) {
    int fd = ::open(path.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (fd < 0) {
        err_code = "shm_write_failed";
        err_msg = std::string("failed to open shmOut: ") + strerror(errno);
        return false;
    }
    size_t off = 0;
    size_t need = rgba.size();
    while (off < need) {
        ssize_t w = ::write(fd, rgba.data()+off, need-off);
        if (w <= 0) {
            if (w < 0 && errno == EINTR) continue;
            break;
        }
        off += w;
    }
    ::close(fd);
    if (off != need) {
        err_code = "shm_write_incomplete";
        err_msg = "shmOut write incomplete";
        return false;
    }
    return true;
}

// ---------- process hygiene ----------
// p6: host hygiene — keep the main thread off core 0 (IRQ-heavy) and give it
// scheduling priority. Cheap, no downside, shaves scheduling jitter.
static void apply_cpu_affinity_and_nice() {
    cpu_set_t set;
    CPU_ZERO(&set);
    int ncpus = (int)sysconf(_SC_NPROCESSORS_ONLN);
    // Pin to cores 2..(ncpus-1): dodges kernel housekeeping on core 0/1
    for (int c = 2; c < ncpus; ++c) CPU_SET(c, &set);
    if (sched_setaffinity(0, sizeof(set), &set) == 0) {
        fprintf(stderr, "[host] affinity set to cores 2-%d\n", ncpus - 1);
    }
    // Best-effort nicer scheduling; without root only positive nice works.
    setpriority(PRIO_PROCESS, 0, -5);
    fprintf(stderr, "[host] nice=%d (negative needs root/cap)\n", getpriority(PRIO_PROCESS, 0));
}

// Takt-Check (Hygiene, 2.9.): ein gedrosselter Governor erklärt die
// +7 % beim 1080p-Lauf. Reine Diagnose, ändert nichts.
static void log_gpu_governor_levels() {
    for (const auto& entry : std::filesystem::directory_iterator("/sys/class/drm")) {
        if (!entry.is_directory()) continue;
        const std::string name = entry.path().filename().string();
        if (name.rfind("card", 0) != 0 || name.find('-') != std::string::npos) continue;
        const std::string lvl_path = entry.path().string() + "/device/power_dpm_force_performance_level";
        if (FILE* f = fopen(lvl_path.c_str(), "r")) {
            char lvl[32] = {};
            if (fgets(lvl, sizeof(lvl), f)) {
                lvl[strcspn(lvl, "\n")] = 0;
                fprintf(stderr, "[host] %s power_dpm_force_performance_level=%s\n", name.c_str(), lvl);
            }
            fclose(f);
        }
    }
}

// ---------- model discovery ----------
static std::string find_model_file(const char* def, const char* env) {
    const char* e = std::getenv(env);
    if (e && std::filesystem::exists(e)) return e;
    if (std::filesystem::exists(def)) return def;
    // try relative to exe
    char exe[4096] = {};
    ssize_t n = ::readlink("/proc/self/exe", exe, sizeof(exe)-1);
    if (n > 0) {
        std::filesystem::path p = std::filesystem::path(std::string(exe, n)).parent_path();
        for (int i=0;i<5;i++) {
            auto cand = p / def;
            if (std::filesystem::exists(cand)) return cand.string();
            // also try models/... relative to repo
            cand = p / "../../models/realesrgan/ncnn" / std::filesystem::path(def).filename();
            if (std::filesystem::exists(cand)) return cand.string();
            p = p.parent_path();
        }
    }
    // fallback absolute repo path
    std::string fallback = "/home/daniel/Projects/anime4kBrowser/models/realesrgan/ncnn/" + std::string(std::filesystem::path(def).filename());
    if (std::filesystem::exists(fallback)) return fallback;
    return def;
}

// ---------- pipeline cache location ----------
// Pipeline cache: try to load on-disk cache for faster cold start (RADV also caches, but this covers ncnn's pipeline layer)
// We keep it simple: load if exists, save on exit. Not critical for steady-state benchmark.
// ncnn's PipelineCache is per-device; the load/save itself lives in UpscaleCore.
static std::string pipeline_cache_dir() {
    const char* cache_home = std::getenv("XDG_CACHE_HOME");
    return cache_home ? std::string(cache_home) + "/aniwebscale" : std::string(std::getenv("HOME") ? std::getenv("HOME") : "/tmp") + "/.cache/aniwebscale";
}

#if NCNN_VULKAN
// Deep-fusion premise probe (E4): times ONE 64ch fp16 layer-boundary
// roundtrip (read 64*H*W fp16 + write back, ping-pong A<->B exactly like
// runTiled's actA/actB, same blob-pooled VkMats). Median * 16 body boundaries
// is the hard ceiling for any deep-fusion win. Fresh VkCompute per submit
// (spike lifetime rule: reuse across submits SIGSEGVs in RADV). Prints JSON
// to stdout, returns 0 on success. No weights, no models, no network.
static int run_traffic_test(ncnn::VulkanDevice* device, ncnn::VkAllocator* blob,
                            ncnn::VkAllocator* staging, int width, int height, int iters) {
    ncnn::Pipeline* pipe = new ncnn::Pipeline(device);
    pipe->set_local_size_xyz(8, 8, 4);
    {
        std::vector<ncnn::vk_specialization_type> specs;
        if (pipe->create(srvgg_traffic_comp_data, sizeof(srvgg_traffic_comp_data), specs) != 0) {
            fprintf(stderr, "[traffic] pipeline creation failed\n");
            delete pipe;
            return 1;
        }
    }
    ncnn::VkMat actA;
    actA.create(width, height, 64, (size_t)2, 1, blob);
    ncnn::VkMat actB;
    actB.create(width, height, 64, (size_t)2, 1, blob);
    if (!actA.data || !actB.data) {
        fprintf(stderr, "[traffic] activation alloc failed\n");
        delete pipe;
        return 1;
    }
    const int stride = static_cast<int>(actA.cstep);
    ncnn::Option topt;
    topt.blob_vkallocator = blob;
    topt.workspace_vkallocator = blob;
    topt.staging_vkallocator = staging;
    std::vector<double> samples;
    samples.reserve((size_t)iters * 2);
    bool flip = false;
    double warmupMs = 0.0;
    for (int it = -1; it < iters; it++) {
        for (int half = 0; half < 2; half++) {
            const ncnn::VkMat& inMat = flip ? actB : actA;
            ncnn::VkMat& outMat = flip ? actA : actB;
            ncnn::VkCompute cmd(device);
            std::vector<ncnn::VkMat> binds(2);
            binds[0] = inMat;
            binds[1] = outMat;
            std::vector<ncnn::vk_constant_type> consts(3);
            consts[0].i = width;
            consts[1].i = height;
            consts[2].i = stride;
            ncnn::VkMat disp;
            disp.w = width;
            disp.h = height;
            disp.c = 64;
            cmd.record_pipeline(pipe, binds, consts, disp);
            const auto t0 = std::chrono::steady_clock::now();
            if (cmd.submit_and_wait() != 0) {
                fprintf(stderr, "[traffic] submit failed at iter %d\n", it);
                delete pipe;
                return 1;
            }
            const auto t1 = std::chrono::steady_clock::now();
            const double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
            if (it < 0 && half == 0) warmupMs = ms;
            else if (it >= 0) samples.push_back(ms);
            flip = !flip;
        }
    }
    // Honesty checksum: download the final buffer, prove the writes landed.
    ncnn::Mat dst;
    {
        ncnn::VkCompute cmd(device);
        cmd.record_clone(flip ? actB : actA, dst, topt);
        if (cmd.submit_and_wait() != 0 || !dst.data) {
            fprintf(stderr, "[traffic] checksum download failed\n");
            delete pipe;
            return 1;
        }
    }
    std::sort(samples.begin(), samples.end());
    const double median = samples[samples.size() / 2];
    const double p95 = samples[(samples.size() * 95) / 100];
    const auto* words = static_cast<const uint16_t*>(dst.data);
    const size_t nwords = dst.total();
    const double bytesPerBoundary = 2.0 * 64 * width * height * 2;
    const double gbps = (bytesPerBoundary / 1e9) / (median / 1e3);
    printf("{\"w\":%d,\"h\":%d,\"channels\":64,\"bytesPerBoundary\":%.0f,"
           "\"iters\":%d,\"warmupMs\":%.3f,\"medianMs\":%.3f,\"p95Ms\":%.3f,"
           "\"gbps\":%.1f,\"fusionCeiling16Ms\":%.2f,"
           "\"check\":[\"0x%04x\",\"0x%04x\"]}\n",
           width, height, bytesPerBoundary, iters, warmupMs, median, p95,
           gbps, median * 16, words[0], words[nwords - 1]);
    delete pipe;
    return 0;
}
#endif

int main(int argc, char** argv) {
    bool use_fp16 = true;
    // Idle reaper (Zombie-Fix, 2.9.): exit after N seconds without any frame
    // on EITHER transport so a forgotten host stops pinning GPU allocations.
    // The browser re-spawns the host via Native Messaging on the next frame;
    // the broker drops the dead port on onDisconnect. 0 disables the reaper.
    long idle_timeout_s = 90;
    if (const char* e = std::getenv("ANIWEBSCALE_HOST_IDLE_TIMEOUT_S")) {
        char* end = nullptr;
        long v = std::strtol(e, &end, 10);
        if (end != e && v >= 0) idle_timeout_s = v;
    }
    // INT8-Experiment (2.9., ncnn-Pin post #6751): quantisiertes Modell über
    // separate Dateien, per Default aus. Dateien erzeugt
    // native/spike/calibrate-ncnn-int8.sh (ncnn2table/ncnn2int8).
    bool use_int8 = false;
    std::string int8_param, int8_bin;
    if (const char* e = std::getenv("ANIWEBSCALE_NCNN_INT8_PARAM")) int8_param = e;
    if (const char* e = std::getenv("ANIWEBSCALE_NCNN_INT8_BIN")) int8_bin = e;
    // E4 phase 1: hand-written Vulkan SRVGG instead of the ncnn graph.
    // Opt-in per process (a per-request protocol param comes with
    // productization, after the perf gates pass): single-pass frames only,
    // everything else — and any srvgg failure — falls back to ncnn.
    bool useSrvggEngine = false;
    if (const char* e = std::getenv("ANIWEBSCALE_SRVGG_ENGINE")) {
        const std::string v(e);
        useSrvggEngine = (v == "srvgg" || v == "1");
    }
    // Stufe 1 (Perf-Programm): infer at ceil(W/D)xceil(H/D), D=1 voll.
    // Gate-Beleg: div2 30.4 dB PASS, div4 22.9 dB FAIL (bench/target-res-*).
    // Nur 2 ist freigegeben; andere Werte fallen auf 1 zurueck.
    int inferDiv = 1;
    if (const char* e = std::getenv("ANIWEBSCALE_INFER_DIV")) {
        const int v = std::atoi(e);
        inferDiv = (v == 2) ? 2 : 1;
        fprintf(stderr, "[host] ANIWEBSCALE_INFER_DIV=%s -> div=%d\n", e, inferDiv);
    }
    // Stufe 5: Session-Warmup an (Opt-out ANIWEBSCALE_NO_WARMUP=1); der
    // --traffic-test misst bewusst kalt und bleibt ohne Vorwaermung.
    bool noWarmup = false;
    if (const char* e = std::getenv("ANIWEBSCALE_NO_WARMUP")) {
        noWarmup = std::atoi(e) != 0;
    }
    // Deep-fusion premise probe: --traffic-test W H [ITERS] times one 64ch
    // fp16 layer boundary and exits (no models, no network).
    bool trafficTest = false;
    int trafficW = 0, trafficH = 0, trafficIters = 10;
    std::string param_path = find_model_file(DEFAULT_PARAM_PATH, "ANIWEBSCALE_NCNN_PARAM");
    std::string bin_path = find_model_file(DEFAULT_BIN_PATH, "ANIWEBSCALE_NCNN_BIN");
    for (int i=1;i<argc;i++) {
        std::string a = argv[i];
        if (a == "--no-fp16") {
            // The shared upscale core is fp16-storage GPU-only: with fp16 off
            // the pre/postproc pipelines are never created and every frame
            // fails with "gpu postproc pipeline unavailable". Refuse at
            // startup instead of reporting ready and failing per frame.
            fprintf(stderr, "[host] --no-fp16 is not supported: the GPU path is fp16-storage-only\n");
            return 2;
        }
        else if (a == "--fp16") use_fp16 = true;
        else if (a == "--param" && i+1 < argc) param_path = argv[++i];
        else if (a == "--bin" && i+1 < argc) bin_path = argv[++i];
        else if (a == "--int8") use_int8 = true;
        else if (a == "--no-int8") use_int8 = false;
        else if (a == "--int8-param" && i+1 < argc) int8_param = argv[++i];
        else if (a == "--int8-bin" && i+1 < argc) int8_bin = argv[++i];
        else if (a == "--traffic-test" && i+2 < argc) {
            trafficTest = true;
            trafficW = std::atoi(argv[++i]);
            trafficH = std::atoi(argv[++i]);
            if (i+1 < argc && argv[i+1][0] != '-') trafficIters = std::atoi(argv[++i]);
            if (trafficW <= 0 || trafficH <= 0 || trafficIters <= 0) {
                fprintf(stderr, "[host] --traffic-test needs W H [ITERS>0]\n");
                return 1;
            }
        }
        else if (a == "--idle-timeout" && i+1 < argc) {
            char* end = nullptr;
            const long idle_value = std::strtol(argv[++i], &end, 10);
            if (end == nullptr || *end != '\0' || idle_value < 0) {
                fprintf(stderr, "[host] invalid --idle-timeout value: %s\n", argv[i]);
                return 1;
            }
            idle_timeout_s = idle_value;
        }
        else if (a == "--help" || a == "-h") {
            fprintf(stderr, "Usage: %s [--param file.param] [--bin file.bin] [--fp16] [--idle-timeout SECS]\n"
                            "       [--int8 --int8-param file-int8.param --int8-bin file-int8.bin]\n", argv[0]);
            return 0;
        }
    }

    fprintf(stderr, "[host] AniWebScale ncnn-Vulkan host starting\n");
    fprintf(stderr, "[host] param=%s\n[host] bin=%s fp16=%d int8=%d\n",
            param_path.c_str(), bin_path.c_str(), use_fp16, use_int8);
    if (use_int8) {
        if (int8_param.empty() || int8_bin.empty()
            || !std::filesystem::exists(int8_param) || !std::filesystem::exists(int8_bin)) {
            fprintf(stderr, "[host] --int8 needs existing --int8-param/--int8-bin files "
                            "(run native/spike/calibrate-ncnn-int8.sh first)\n");
            return 1;
        }
        fprintf(stderr, "[host] int8 param=%s\n[host] int8 bin=%s\n",
                int8_param.c_str(), int8_bin.c_str());
    }

    std::string pipeline_cache_path = pipeline_cache_dir() + "/ncnn_pipeline_cache.bin";

    apply_cpu_affinity_and_nice();

    // Build the upscale core: gpu instance + device, pipeline cache, models,
    // pipelines, persistent allocators. Any failure here is fatal (rc 1).
    aniwebscale::UpscaleCore core;
    if (!core.init_device()) return 1;
    fprintf(stderr, "[host] heap budget=%u MB idle_timeout=%lds\n",
            core.heap_budget_start_mb(), idle_timeout_s);
    log_gpu_governor_levels();
    core.load_pipeline_cache(pipeline_cache_path, pipeline_cache_dir());

    aniwebscale::UpscaleCoreConfig core_cfg;
    core_cfg.use_fp16 = use_fp16;
    core_cfg.use_int8 = use_int8;
    core_cfg.use_srvgg_engine = useSrvggEngine;
    core_cfg.infer_div = inferDiv;
    core_cfg.param_path = param_path;
    core_cfg.bin_path = bin_path;
    core_cfg.int8_param = int8_param;
    core_cfg.int8_bin = int8_bin;
    if (!core.load_models(core_cfg)) return 1;

    // Stufe 5: First-Dispatch-Tax vom ersten Frame an den Startup ziehen.
    if (!noWarmup && !trafficTest) core.warmup();
    else fprintf(stderr, "[host] session warmup skipped\n");

#if NCNN_VULKAN
    if (trafficTest) {
        const int rc = run_traffic_test(core.device(), core.blob_allocator(), core.staging_allocator(), trafficW, trafficH, trafficIters);
        // Spike lifetime rule (see normal exit): the Net must release GPU
        // resources before the instance dies, or the destructor SIGSEGVs.
        core.shutdown();
        return rc;
    }
#endif

    // Idle-Reaper-Uhr: beide Transporte (stdin-framed + HTTP-Loopback) melden
    // Aktivität; der HTTP-Pfad läuft auf einem eigenen Thread, daher atomar.
    // Millisekunden seit einem beliebigen steady_clock-Nullpunkt, nur für
    // Differenzen benutzt.
    core.note_activity();
    aniwebscale::HttpTransport http_transport([&core](const unsigned char* rgba_in, int in_w, int in_h,
                                                      int target_w, int target_h,
                                                      std::vector<unsigned char>& out, int& out_w, int& out_h,
                                                      std::string& emsg, const std::string& engine) -> int {
        // Shared upscale core (p7): identical GPU path for stdin and HTTP
        // transports; the core serializes GPU ownership between them.
        const bool ok = core.run_upscale(rgba_in, in_w, in_h, target_w, target_h, out, out_w, out_h, emsg, engine);
        if (ok) core.note_activity();
        return ok ? 0 : 1;
    });
    {
        std::string http_err;
        if (http_transport.start(http_err)) {
            fprintf(stderr, "[host] http transport ready on 127.0.0.1:%d\n", http_transport.port());
        } else {
            fprintf(stderr, "[host] http transport FAILED: %s (stdin b64/shm paths still work)\n", http_err.c_str());
        }
    }

    // Main loop: poll() statt blockierendem Read, damit der Idle-Reaper
    // feuern kann, während stdin still ist. Jede eingehende Nachricht (auch
    // hello/capabilities) zählt als Aktivität.
    std::string payload;
    for (;;) {
        if (idle_timeout_s > 0) {
            const uint64_t idle_ms = core.idle_ms();
            const uint64_t budget_ms = (uint64_t)idle_timeout_s * 1000;
            if (idle_ms >= budget_ms) {
                fprintf(stderr, "[host] idle timeout after %llu ms (%llu frames served): exiting, browser re-spawns on next frame\n",
                        (unsigned long long)idle_ms,
                        (unsigned long long)core.frames_served());
                fprintf(stderr, "[host] heap budget at idle exit=%u MB (start=%u MB)\n",
                        core.device()->get_heap_budget(), core.heap_budget_start_mb());
                break;
            }
            struct pollfd pfd{STDIN_FILENO, POLLIN, 0};
            const uint64_t wait_ms = budget_ms - idle_ms;
            // poll takes int ms; clamp absurd timeouts instead of narrowing.
            int pr = poll(&pfd, 1, wait_ms > 60000ULL ? 60000 : (int)wait_ms);
            if (pr == 0) continue; // Timeout abgelaufen, oben neu prüfen
            if (pr < 0) {
                if (errno == EINTR) continue;
                fprintf(stderr, "[host] poll failed: %s\n", strerror(errno));
                break;
            }
            if (pfd.revents & (POLLHUP | POLLERR | POLLNVAL)) break; // Browser weg
        }
        if (!read_framed(payload)) break; // EOF: Browser hat den Port getrennt
        core.note_activity();
        auto parsed = anime4k::json::parse(payload);
        if (!parsed.value || !parsed.value->is_object()) {
            fprintf(stderr, "[host] invalid json: %s\n", parsed.error.c_str());
            // send error (no requestId yet — the one error object without the field)
            Object err;
            err["type"] = Value("error");
            err["protocolVersion"] = Value(3.0);
            err["code"] = Value("invalid_json");
            err["message"] = Value(parsed.error);
            err["recoverable"] = Value(true);
            std::string out = anime4k::json::stringify(Value(err));
            write_framed(out);
            continue;
        }
        Object req = *parsed.value->as_object();
        std::string type = get_string(req, "type");
        std::string requestId = get_string(req, "requestId");
        // hello
        if (type == "hello") {
            Object resp;
            resp["type"] = Value("ready");
            resp["protocolVersion"] = Value(3.0);
            resp["requestId"] = Value(requestId);
            resp["httpPort"] = Value((double)http_transport.port());
            resp["httpToken"] = Value(http_transport.token());
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        if (type == "capabilities") {
            Object resp;
            resp["type"] = Value("capabilities");
            resp["protocolVersion"] = Value(3.0);
            resp["requestId"] = Value(requestId);
            resp["windowsCapture"] = Value(false);
            resp["d3d11"] = Value(false);
            resp["vulkanNcnn"] = Value(true);
            resp["realesrganVulkan"] = Value(true);
            resp["realesrganShm"] = Value(true);
            // p7: binary loopback transport (no base64, no preflight)
            resp["realesrganHttp"] = Value(http_transport.port() > 0);
            resp["httpPort"] = Value((double)http_transport.port());
            resp["httpToken"] = Value(http_transport.token());
            // p5: DMA-BUF zero-copy — advertised as unavailable until the browser
            // can hand out capture frames as DMA-BUF fds (no WebExtension API today).
            resp["realesrganDmaBuf"] = Value(false);
            // modes for compatibility
            std::vector<Value> modes; modes.emplace_back("REALESRGAN");
            resp["modes"] = Value(modes);
            std::vector<Value> quals; quals.emplace_back("M"); quals.emplace_back("VL"); quals.emplace_back("UL");
            resp["qualities"] = Value(quals);
            resp["frameGeneration"] = Value(false);
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        if (type == "realesrganUpscale" || type == "upscale") {
            int width = (int)get_number(req, "width", 0);
            int height = (int)get_number(req, "height", 0);
            int target_w = (int)get_number(req, "targetWidth", 0);
            int target_h = (int)get_number(req, "targetHeight", 0);
            std::string b64 = get_string(req, "data");
            std::string shmIn = get_string(req, "shmIn");
            std::string dmaBufIn = get_string(req, "dmaBufIn");
            if (!dmaBufIn.empty()) {
                // p5 stub: DMA-BUF import (VK_EXT_external_memory_dma_buf) needs a
                // browser-side capture path that exports frames as DMA-BUF fds.
                // No WebExtension API exposes this today; see artifacts report.
                write_framed(error_json(requestId, "dma_buf_unsupported",
                    "DMA-BUF import not available: browser capture cannot export DMA-BUF fds (no WebExtension API). Use shmIn/shmOut instead."));
                continue;
            }
            std::string shmOut = get_string(req, "shmOut");
            bool useShmIn = !shmIn.empty();
            bool useShmOut = !shmOut.empty();
            // fp16 request field kept for protocol compatibility; the shared
            // upscale core is fp16-storage GPU-only (validated path).
            [[maybe_unused]] bool reqFp16 = true;
            auto itfp = req.find("fp16");
            if (itfp != req.end()) {
                if (auto b = itfp->second.as_bool()) reqFp16 = *b;
                else if (auto n = itfp->second.as_number()) reqFp16 = *n != 0;
            }
            // width/height sanity
            if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || (b64.empty() && !useShmIn)) {
                write_framed(error_json(requestId, "invalid_request", "missing width/height/data"));
                continue;
            }
            std::vector<unsigned char> rgba;
            if (useShmIn) {
                const char* err_code = nullptr;
                std::string err_msg;
                if (!read_shm_rgba(shmIn, (size_t)width*height*4, rgba, err_code, err_msg)) {
                    write_framed(error_json(requestId, err_code, err_msg));
                    continue;
                }
            } else {
                if (!base64_decode(b64, rgba) || rgba.size() != (size_t)width*height*4) {
                    write_framed(error_json(requestId, "invalid_data", "base64 decode failed or size mismatch"));
                    continue;
                }
            }

            auto t0 = std::chrono::steady_clock::now();
            std::vector<unsigned char> out_rgba;
            int out_w = 0, out_h = 0;
            std::string err_msg;
            // Shared upscale core (p7): identical GPU path for stdin and HTTP
            // transports; the core serializes GPU ownership between them and
            // counts served frames.
            bool ok = core.run_upscale(rgba.data(), width, height, target_w, target_h, out_rgba, out_w, out_h, err_msg);
            if (!ok) {
                write_framed(error_json(requestId, "inference_failed", err_msg.empty() ? "unknown" : err_msg));
                continue;
            }
            auto t1 = std::chrono::steady_clock::now();
            double ms = std::chrono::duration<double,std::milli>(t1 - t0).count();
            fprintf(stderr, "[host] upscale %dx%d -> %dx%d %.1f ms\n", width, height, out_w, out_h, ms);
            if (useShmOut) {
                const char* err_code = nullptr;
                std::string shm_err;
                if (!write_shm_rgba(shmOut, out_rgba, err_code, shm_err)) {
                    write_framed(error_json(requestId, err_code, shm_err));
                    continue;
                }
                Object resp;
                resp["type"] = Value("realesrganResult");
                resp["protocolVersion"] = Value(3.0);
                resp["requestId"] = Value(requestId);
                resp["width"] = Value((double)out_w);
                resp["height"] = Value((double)out_h);
                resp["shmOut"] = Value(shmOut);
                resp["timeMs"] = Value(ms);
                write_framed(anime4k::json::stringify(Value(resp)));
                continue;
            }
            std::string out_b64 = base64_encode(out_rgba.data(), out_rgba.size());
            Object resp;
            resp["type"] = Value("realesrganResult");
            resp["protocolVersion"] = Value(3.0);
            resp["requestId"] = Value(requestId);
            resp["width"] = Value((double)out_w);
            resp["height"] = Value((double)out_h);
            resp["data"] = Value(out_b64);
            resp["timeMs"] = Value(ms);
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        // unknown type
        write_framed(error_json(requestId, "unknown_type", "unknown request type: " + type));
    }

    http_transport.stop();
    // E6: persist the device pipeline cache for the next cold start. Runs
    // after the transport stops (GPU idle, every pipeline compiled) and
    // before the instance dies (the cache dies with the device).
    core.save_pipeline_cache(pipeline_cache_path);
    core.shutdown();
    fprintf(stderr, "[host] shutting down\n");
    return 0;
}
