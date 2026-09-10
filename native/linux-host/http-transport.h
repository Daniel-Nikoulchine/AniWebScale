/*
 * Loopback HTTP transport for the AniWebScale ncnn host (p7).
 *
 * The Native Messaging stdin/stdout channel stays the control plane
 * (hello, capabilities, lifeline). Frame payloads cross a plain HTTP/1.1
 * socket on 127.0.0.1 instead. This removes base64 (+33% bytes) and the
 * 100 MB framed-JSON parse in the browser entirely.
 *
 * Protocol (one request per upscale, keep-alive supported):
 *   POST /upscale?token=<64-hex>&w=<in-w>&h=<in-h> HTTP/1.1
 *   Content-Type: text/plain            (CORS-safelisted: no preflight)
 *   Content-Length: w*h*4
 *   body: raw RGBA8
 * Response:
 *   HTTP/1.1 200 OK
 *   Content-Type: application/octet-stream
 *   Content-Length: (4w)*(4h)*4
 *   body: raw RGBA8 (the full 4x frame)
 *
 * The token rides in the query string and the content type is text/plain
 * so the request qualifies as a CORS "simple request": zero preflight
 * round trips from https video pages. Loopback (127.0.0.1) is potentially
 * trustworthy, so this is not mixed content. Access-Control-Allow-Private-
 * Network is answered for Chrome's PNA preflight should it ever fire.
 *
 * The handler runs the upscale on the HTTP thread; the stdin control loop
 * never blocks on it. The host serializes handler invocations with a mutex
 * so exactly one thread owns the GPU state at a time.
 *
 * This header is the declaration seam; the accept loop, buffered parser,
 * query parsing and response writing live in http-transport.cpp. The three
 * primitives below (parse_query, write_response, handle_conn) are free
 * functions so a test can drive them directly.
 */

#pragma once

#include <atomic>
#include <cstdint>
#include <string>
#include <thread>
#include <vector>

namespace aniwebscale {

// Runs one upscale on the HTTP thread. Returns 0 on success; the transport
// answers HTTP 500 with `err` otherwise. `out` receives out_w*out_h*4 bytes.
// `err_stage` carries the failure phase (upload/tile/submit) so the 500 text
// can name it. `target_w`/`target_h` are the OPTIONAL presentation dimensions
// (<= 0 means "full 4x frame"): when smaller than the network output the host
// box-averages before download and the response body is target-sized instead.
class UpscaleHandler {
public:
    virtual ~UpscaleHandler() = default;
    virtual int handle_frame(const unsigned char* rgba_in, int width, int height,
                             int target_w, int target_h,
                             std::vector<unsigned char>& out, int& out_w, int& out_h,
                             std::string& err, std::string& err_stage,
                             const std::string& engine) = 0;
};

// Transport limits. MAX_FRAME_DIM is mirrored by the TypeScript client and a
// drift-guard test parses this exact token out of this header — keep the
// `MAX_FRAME_DIM = <int>` spelling.
inline constexpr long long MAX_BODY = 64 * 1024 * 1024; // 4096x4096 RGBA8
inline constexpr int MAX_FRAME_DIM = 4096;
// Per-request read budget (request line + headers + body) in ms.
inline constexpr uint64_t REQUEST_BUDGET_MS = 30'000;

// "w=640&h=360&token=...&tw=..&th=..&engine=srvgg" -> values by key.
// engine selects the inference backend per request ("" = default ncnn,
// "srvgg" = hand-written Vulkan SRVGG); unknown values fall back to "".
void parse_query(const std::string& query, std::string& token, int& w, int& h,
                 int& tw, int& th, std::string& engine);

// Write one HTTP/1.1 response (status line + fixed headers + optional body)
// to `fd`. See the wire contract in the file header.
void write_response(int fd, int status, const std::string& text,
                    const unsigned char* body, long long body_len,
                    int out_w, int out_h, bool keep_alive);

// Serve one accepted connection (keep-alive loop) until it closes or a
// request is malformed. Declared for direct testing; the accept loop calls
// it per connection.
void handle_conn(int fd, const std::atomic<bool>& stop, const std::string& token,
                 UpscaleHandler& handler);

class HttpTransport {
public:
    explicit HttpTransport(UpscaleHandler& handler) : handler_(handler) {}
    HttpTransport(const HttpTransport&) = delete;
    HttpTransport& operator=(const HttpTransport&) = delete;
    ~HttpTransport();

    // Binds 127.0.0.1:0 (ephemeral), generates the token, starts the accept
    // loop in a background thread. Returns false on bind failure.
    bool start(std::string& err);

    int port() const { return port_; }
    const std::string& token() const { return token_; }

    void stop();

private:
    void accept_loop();

    UpscaleHandler& handler_;
    int listen_fd_ = -1;
    int port_ = 0;
    std::string token_;
    std::thread thread_;
    std::atomic<bool> stop_{false};
    // The connection currently served by the accept thread (-1 when none).
    // stop() shuts it down to unblock a recv() parked on an idle socket.
    std::atomic<int> conn_fd_{-1};
};

} // namespace aniwebscale
