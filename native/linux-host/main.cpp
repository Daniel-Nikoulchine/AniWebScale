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
#include <csignal>
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
#include "anime4k/native_error_codes.hpp"
#include "anime4k/protocol_version.hpp"
#include "net.h"
#include "gpu.h"
#include "http-transport.h"
#include "upscale-core.h"
#include "srvgg-vulkan.h"

#if NCNN_VULKAN
#include "srvgg_traffic.comp.hex.h"
#endif

// Wire protocol version echoed on every framed reply (hello/capabilities/
// result/error). The value comes from the shared native header
// (native/include/anime4k/protocol_version.hpp) so the Windows and Linux
// hosts cannot drift; this alias only adapts it to the double the JSON
// builder takes. A TS drift test keeps the shared constant aligned with
// NATIVE_PROTOCOL_VERSION in src/native/protocol.ts.
static constexpr double kProtocolVersion = static_cast<double>(anime4k::protocol::kProtocolVersion);

// Canonical native-host error codes (shared header, TS mirror and drift test).
namespace native_errors = anime4k::protocol::native_errors;

// HTTP transport adapter: one upscale per request over the shared core. The
// core serializes GPU ownership; a successful frame also bumps the idle clock
// (the stdin loop does the same on message receipt).
struct CoreUpscaleHandler final : aniwebscale::UpscaleHandler {
    explicit CoreUpscaleHandler(aniwebscale::UpscaleCore& core) : core_(core) {}
    int handle_frame(const unsigned char* rgba_in, int in_w, int in_h,
                     int target_w, int target_h,
                     std::vector<unsigned char>& out, int& out_w, int& out_h,
                     std::string& emsg, std::string& err_stage,
                     const std::string& engine) override {
        const bool ok = core_.run_upscale(rgba_in, in_w, in_h, target_w, target_h,
                                          out, out_w, out_h, emsg, engine, &err_stage);
        if (ok) core_.note_activity();
        return ok ? 0 : 1;
    }
    aniwebscale::UpscaleCore& core_;
};

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
    const size_t len = in.size();
    size_t i = 0;
    auto is_ws = [](char c) {
        return c == '\n' || c == '\r' || c == ' ' || c == '\t';
    };
    // Quantum loop: collect exactly 4 non-whitespace symbols before decoding.
    // Whitespace is skipped WITHOUT consuming a quantum slot, so interior
    // whitespace can never realign the 4-char window (the old ++i skip did).
    // Padding ('=') is only legal in the final quantum; after it only
    // whitespace may follow — trailing garbage fails instead of being
    // silently ignored. Legit senders (btoa output) contain neither, so this
    // is strictly more correct with identical results on valid input.
    for (;;) {
        char q[4];
        int qn = 0;
        while (qn < 4 && i < len) {
            const char c = in[i++];
            if (is_ws(c)) continue;
            q[qn++] = c;
        }
        if (qn == 0) return true; // clean end (whitespace tail ok)
        if (qn < 4) return false; // truncated quantum
        int8_t d[4];
        for (int k = 0; k < 4; k++) {
            if (q[k] == '=') {
                d[k] = -2;
            } else {
                d[k] = b64_dec_table[(unsigned char)q[k]];
                if (d[k] < 0) return false; // non-alphabet symbol
            }
        }
        if (d[0] == -2 || d[1] == -2) return false; // padding in slots 0-1
        if (d[2] == -2) {
            if (d[3] != -2) return false; // "xx=y" is malformed
            const uint32_t triple = (uint32_t(d[0]) << 18) | (uint32_t(d[1]) << 12);
            out.push_back((triple >> 16) & 0xFF);
            while (i < len) {
                if (!is_ws(in[i++])) return false;
            }
            return true;
        }
        if (d[3] == -2) {
            const uint32_t triple = (uint32_t(d[0]) << 18) | (uint32_t(d[1]) << 12) | (uint32_t(d[2]) << 6);
            out.push_back((triple >> 16) & 0xFF);
            out.push_back((triple >> 8) & 0xFF);
            while (i < len) {
                if (!is_ws(in[i++])) return false;
            }
            return true;
        }
        const uint32_t triple = (uint32_t(d[0]) << 18) | (uint32_t(d[1]) << 12)
            | (uint32_t(d[2]) << 6) | uint32_t(d[3]);
        out.push_back((triple >> 16) & 0xFF);
        out.push_back((triple >> 8) & 0xFF);
        out.push_back(triple & 0xFF);
    }
}

// ---------- framed I/O ----------
static uint64_t steady_ms() {
    return (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

// Deadline-bounded exact read. Without it a peer that trickles one byte at
// a time (or a spurious poll wakeup with revents==0) parks the host in a
// blocking read forever: GPU stays pinned and the idle reaper never fires.
// deadline_ms is an absolute steady-clock timestamp (UINT64_MAX = none);
// expiry sets timed_out instead of failing like EOF so the caller can log
// the reaper exit rather than a disconnect.
static bool read_exact(int fd, void* buf, size_t n, uint64_t deadline_ms, bool& timed_out) {
    timed_out = false;
    auto* p = static_cast<char*>(buf);
    size_t off = 0;
    while (off < n) {
        const uint64_t now = steady_ms();
        if (now >= deadline_ms) {
            timed_out = true;
            return false;
        }
        const uint64_t remain = deadline_ms - now;
        struct pollfd pfd{fd, POLLIN, 0};
        const int pr = poll(&pfd, 1, remain > 60000ULL ? 60000 : (int)remain);
        if (pr == 0) continue; // slice elapsed, deadline re-checked above
        if (pr < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        if (!(pfd.revents & POLLIN)) return false; // POLLERR/POLLHUP/POLLNVAL
        ssize_t r = ::read(fd, p + off, n - off);
        if (r == 0) return false; // EOF
        if (r < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        off += (size_t)r;
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
static bool read_framed(std::string& payload, bool& oversize, bool& timed_out, uint64_t deadline_ms) {
    oversize = false;
    timed_out = false;
    uint32_t len = 0;
    if (!read_exact(STDIN_FILENO, &len, 4, deadline_ms, timed_out)) return false;
    // little endian
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    len = __builtin_bswap32(len);
#endif
    if (len > 100 * 1024 * 1024) {
        // One malicious length word must not DoS the host until respawn:
        // drain and discard the body so the next read starts at a frame
        // boundary, then nack below. EOF while draining still exits.
        fprintf(stderr, "[host] framed message too large: %u, discarding\n", len);
        char sink[65536];
        uint32_t left = len;
        while (left > 0) {
            const size_t want = left > sizeof(sink) ? sizeof(sink) : left;
            if (!read_exact(STDIN_FILENO, sink, want, deadline_ms, timed_out)) return false;
            left -= static_cast<uint32_t>(want);
        }
        oversize = true;
        return true;
    }
    payload.resize(len);
    if (len == 0) return true;
    return read_exact(STDIN_FILENO, payload.data(), len, deadline_ms, timed_out);
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
// Recoverability by error class: a malformed, invalid or unsupported request
// can never succeed by retrying the same bytes (permanent, so the client
// falls back), while an inference or shm-I/O hiccup may clear on the next
// frame (transient). Mirrors the Windows host's recoverable semantics.
static bool error_code_recoverable(const char* code) {
    return code == native_errors::kInferenceFailed
        || code == native_errors::kShmOpenFailed
        || code == native_errors::kShmReadFailed
        || code == native_errors::kShmWriteFailed
        || code == native_errors::kShmWriteIncomplete;
}

// All error objects share the same shape. `stage` is emitted only for
// inference_failed (upload/tile/submit); empty means "omit the field".
static std::string error_json(const std::string& requestId, const char* code,
                              const std::string& message, const std::string& stage = "") {
    Object err;
    err["type"] = Value("error");
    err["protocolVersion"] = Value(kProtocolVersion);
    err["requestId"] = Value(requestId);
    err["code"] = Value(code);
    err["message"] = Value(message);
    err["recoverable"] = Value(error_code_recoverable(code));
    if (!stage.empty()) err["stage"] = Value(stage);
    return anime4k::json::stringify(Value(err));
}

// The one error shape without a requestId: invalid_json and message_too_large
// fire before/without a parsed request, so there is no id to echo.
static std::string error_json_unaddressed(const char* code, const std::string& message) {
    Object err;
    err["type"] = Value("error");
    err["protocolVersion"] = Value(kProtocolVersion);
    err["code"] = Value(code);
    err["message"] = Value(message);
    err["recoverable"] = Value(error_code_recoverable(code));
    return anime4k::json::stringify(Value(err));
}

// Strict field gate: every recognized framed request type has an exact
// allow-list, so a typo or a forward-dated field is rejected instead of
// silently ignored (the Windows host's check_keys semantics, without
// enforcing presence — optional fields the client omits simply stay absent).
// Returns the first unexpected key, or nullptr when the frame is clean.
static const char* first_unknown_key(const Object& o,
                                     std::initializer_list<const char*> allowed) {
    for (const auto& [key, unused] : o) {
        (void)unused;
        bool known = false;
        for (const char* candidate : allowed) {
            if (key == candidate) { known = true; break; }
        }
        if (!known) return key.c_str();
    }
    return nullptr;
}

// ---------- shm file I/O ----------
// The shm transport moves throwaway frame files; it must never become a
// file-overwrite primitive: confine both directions to the shared-memory
// filesystem, reject traversal, and never follow symlinks (a planted
// /dev/shm link must fail closed, not redirect the frame into it). Traversal
// is checked segment-wise: only a whole segment of "." or ".." is rejected,
// so a legitimate filename like "frame..bin" still passes.
static bool is_safe_shm_path(const std::string& path) {
    if (path.compare(0, 9, "/dev/shm/") != 0) return false;
    if (path.size() >= 1024) return false;
    size_t start = 9; // after "/dev/shm/"
    while (start <= path.size()) {
        const size_t slash = path.find('/', start);
        const size_t end = slash == std::string::npos ? path.size() : slash;
        const std::string segment = path.substr(start, end - start);
        if (segment == "." || segment == "..") return false;
        if (slash == std::string::npos) break;
        start = slash + 1;
    }
    return true;
}
// Read w*h*4 bytes of RGBA8 from a shm file path. On failure fills err_code /
// err_msg with the wire-level error identity.
static bool read_shm_rgba(const std::string& path, size_t need,
                           std::vector<unsigned char>& rgba,
                           const char*& err_code, std::string& err_msg) {
    if (!is_safe_shm_path(path)) {
        err_code = native_errors::kShmPathRejected;
        err_msg = "shmIn must live under /dev/shm/";
        return false;
    }
    int fd = ::open(path.c_str(), O_RDONLY | O_NOFOLLOW);
    if (fd < 0) {
        err_code = native_errors::kShmOpenFailed;
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
        err_code = native_errors::kShmReadFailed;
        err_msg = "shmIn size mismatch";
        return false;
    }
    return true;
}

// Write a result frame to a shm file path. On failure fills err_code / err_msg.
static bool write_shm_rgba(const std::string& path, const std::vector<unsigned char>& rgba,
                           const char*& err_code, std::string& err_msg) {
    if (!is_safe_shm_path(path)) {
        err_code = native_errors::kShmPathRejected;
        err_msg = "shmOut must live under /dev/shm/";
        return false;
    }
    int fd = ::open(path.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW, 0600);
    if (fd < 0) {
        err_code = native_errors::kShmWriteFailed;
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
        err_code = native_errors::kShmWriteIncomplete;
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
// +7 % beim 1080p-Lauf. Reine Diagnose, ändert nichts — und darf nie fatal
// sein (headless/Container ohne /sys/class/drm).
static void log_gpu_governor_levels() {
    std::error_code ec;
    if (!std::filesystem::exists("/sys/class/drm", ec) || ec) return;
    for (const auto& entry : std::filesystem::directory_iterator("/sys/class/drm", ec)) {
        if (ec) return;
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
    // A browser disconnect mid-reply must fail the write (EPIPE via the
    // existing false-returns), never kill the host: framed stdout replies
    // carry multi-MB base64 bodies, and the HTTP path already uses
    // MSG_NOSIGNAL for the same reason.
    std::signal(SIGPIPE, SIG_IGN);
    bool use_fp16 = true;
    // fp32-storage mode opt-in (quality reference): numeric env for tooling
    // (benchmarks, the wall probe) plus the --no-fp16 flag below. The
    // extension cannot pass env through a native-messaging manifest, so this
    // stays a process-launch option until a runtime precision message lands.
    if (const char* e = std::getenv("ANIWEBSCALE_NO_FP16")) {
        use_fp16 = std::atoi(e) == 0;
        fprintf(stderr, "[host] ANIWEBSCALE_NO_FP16=%s -> fp16=%d\n", e, use_fp16);
    }
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
    // fp32 governor: keeps the fp32-storage path inside a frame budget by
    // reducing the inference scale (postproc upscales to the target). On by
    // default only in fp32 mode; the ~44 ms net budget leaves ~22 ms of head
    // room under the 15 fps (66.7 ms) wall-probe budget for p95 jitter. Set
    // the env to 0 to disable the governor (full-resolution fp32 reference).
    double fp32BudgetMs = 44.0;
    double fp32MsPerPx = 3.0e-4;
    double fp32MinScale = 0.5;
    if (const char* e = std::getenv("ANIWEBSCALE_FP32_BUDGET_MS")) {
        fp32BudgetMs = std::atof(e);
        fprintf(stderr, "[host] ANIWEBSCALE_FP32_BUDGET_MS=%s -> %.1f\n", e, fp32BudgetMs);
    }
    if (const char* e = std::getenv("ANIWEBSCALE_FP32_MS_PER_PX")) fp32MsPerPx = std::atof(e);
    if (const char* e = std::getenv("ANIWEBSCALE_FP32_MIN_SCALE")) fp32MinScale = std::atof(e);
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
            // fp32-storage mode: the network, GPU preproc and GPU postproc all
            // run with 32-bit channels. Numerically exact (no fp16 rounding),
            // ~2.5x slower on NAVI22; the hand-written srvgg engine is disabled.
            use_fp16 = false;
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
    core_cfg.fp32_budget_ms = fp32BudgetMs;
    core_cfg.fp32_ms_per_px = fp32MsPerPx;
    core_cfg.fp32_min_scale = fp32MinScale;
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
    // Shared upscale core (p7): identical GPU path for stdin and HTTP
    // transports; the core serializes GPU ownership between them.
    CoreUpscaleHandler http_handler(core);
    aniwebscale::HttpTransport http_transport(http_handler);
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
    // hello/capabilities) zählt als Aktivität. Der framed Read läuft gegen
    // dieselbe Deadline: ein Peer, der nach dem poll-Signal nur tröpfelt
    // (1 Byte pro Wakeup), dürfte sonst den Reaper unbegrenzt umgehen und
    // die GPU gepinnt halten.
    std::string payload;
    for (;;) {
        uint64_t read_deadline_ms = UINT64_MAX;
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
            read_deadline_ms = steady_ms() + (budget_ms - idle_ms);
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
        bool oversize = false, timed_out = false;
        if (!read_framed(payload, oversize, timed_out, read_deadline_ms)) {
            if (timed_out) {
                // Kein kompletter Frame innerhalb des Idle-Budgets (Trickle-
                // Feed): Reaper-Semantik statt ewigem Block — GPU freigeben,
                // der Browser spawnt bei Bedarf neu.
                fprintf(stderr, "[host] framed read timed out within the idle budget: exiting, browser re-spawns on next frame\n");
            }
            break; // EOF (Browser weg) oder Deadline: in beiden Fällen raus
        }
        if (oversize) {
            // No requestId — the oversize body was discarded unread.
            write_framed(error_json_unaddressed(native_errors::kMessageTooLarge,
                                                "framed message exceeds 100 MiB"));
            continue;
        }
        core.note_activity();
        auto parsed = anime4k::json::parse(payload);
        if (!parsed.value || !parsed.value->is_object()) {
            fprintf(stderr, "[host] invalid json: %s\n", parsed.error.c_str());
            // No requestId yet — the frame never parsed.
            write_framed(error_json_unaddressed(native_errors::kInvalidJson, parsed.error));
            continue;
        }
        Object req = *parsed.value->as_object();
        std::string type = get_string(req, "type");
        std::string requestId = get_string(req, "requestId");
        // Strict per-type field gate: reject an unknown key before dispatch so
        // a typo cannot be silently ignored. Absent optional fields stay
        // absent — this only rejects what the client never sends.
        auto reject_unknown = [&](std::initializer_list<const char*> allowed) {
            const char* unexpected = first_unknown_key(req, allowed);
            if (unexpected == nullptr) return false;
            write_framed(error_json(requestId, native_errors::kInvalidRequest,
                                    std::string("unexpected property: ") + unexpected));
            return true;
        };
        // hello
        if (type == "hello") {
            if (reject_unknown({"type", "protocolVersion", "requestId"})) continue;
            Object resp;
            resp["type"] = Value("ready");
            resp["protocolVersion"] = Value(kProtocolVersion);
            resp["requestId"] = Value(requestId);
            resp["httpPort"] = Value((double)http_transport.port());
            resp["httpToken"] = Value(http_transport.token());
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        if (type == "capabilities") {
            if (reject_unknown({"type", "protocolVersion", "requestId"})) continue;
            Object resp;
            resp["type"] = Value("capabilities");
            resp["protocolVersion"] = Value(kProtocolVersion);
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
            if (reject_unknown({"type", "protocolVersion", "requestId",
                                "width", "height", "targetWidth", "targetHeight",
                                "data", "shmIn", "shmOut", "dmaBufIn", "engine", "fp16"})) continue;
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
                write_framed(error_json(requestId, native_errors::kDmaBufUnsupported,
                    "DMA-BUF import not available: browser capture cannot export DMA-BUF fds (no WebExtension API). Use shmIn/shmOut instead."));
                continue;
            }
            std::string shmOut = get_string(req, "shmOut");
            bool useShmIn = !shmIn.empty();
            bool useShmOut = !shmOut.empty();
            // Per-request engine selection, like the HTTP transport's
            // &engine= query (unknown values fall back to ncnn in the core).
            const std::string reqEngine = get_string(req, "engine");
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
                write_framed(error_json(requestId, native_errors::kInvalidRequest, "missing width/height/data"));
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
                    write_framed(error_json(requestId, native_errors::kInvalidData, "base64 decode failed or size mismatch"));
                    continue;
                }
            }

            auto t0 = std::chrono::steady_clock::now();
            std::vector<unsigned char> out_rgba;
            int out_w = 0, out_h = 0;
            std::string err_msg;
            std::string err_stage;
            // Shared upscale core (p7): identical GPU path for stdin and HTTP
            // transports; the core serializes GPU ownership between them and
            // counts served frames.
            bool ok = core.run_upscale(rgba.data(), width, height, target_w, target_h, out_rgba, out_w, out_h, err_msg, reqEngine, &err_stage);
            if (!ok) {
                write_framed(error_json(requestId, native_errors::kInferenceFailed,
                                        err_msg.empty() ? "unknown" : err_msg, err_stage));
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
                resp["protocolVersion"] = Value(kProtocolVersion);
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
            resp["protocolVersion"] = Value(kProtocolVersion);
            resp["requestId"] = Value(requestId);
            resp["width"] = Value((double)out_w);
            resp["height"] = Value((double)out_h);
            resp["data"] = Value(out_b64);
            resp["timeMs"] = Value(ms);
            write_framed(anime4k::json::stringify(Value(resp)));
            continue;
        }
        // unknown type
        write_framed(error_json(requestId, native_errors::kUnknownType, "unknown request type: " + type));
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
