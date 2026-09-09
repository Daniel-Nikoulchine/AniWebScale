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
 */

#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <functional>
#include <random>
#include <string>
#include <thread>
#include <vector>

#include <netinet/in.h>
#include <arpa/inet.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>
#include <errno.h>

namespace aniwebscale {

// Runs one upscale on the HTTP thread. Returns 0 on success; the transport
// answers HTTP 500 with `err` otherwise. `out` receives out_w*out_h*4 bytes.
// `target_w`/`target_h` are the OPTIONAL presentation dimensions (<= 0 means
// "full 4x frame"): when smaller than the network output the host box-averages
// before download and the response body is target-sized instead.
using UpscaleHandler = std::function<int(const unsigned char* rgba_in, int width, int height,
                                          int target_w, int target_h,
                                          std::vector<unsigned char>& out, int& out_w, int& out_h,
                                          std::string& err, const std::string& engine)>;

class HttpTransport {
public:
    explicit HttpTransport(UpscaleHandler handler) : handler_(handler) {}

    // Binds 127.0.0.1:0 (ephemeral), generates the token, starts the accept
    // loop in a background thread. Returns false on bind failure.
    bool start(std::string& err) {
        listen_fd_ = ::socket(AF_INET, SOCK_STREAM, 0);
        if (listen_fd_ < 0) { err = "socket() failed"; return false; }
        int one = 1;
        ::setsockopt(listen_fd_, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        addr.sin_port = 0; // ephemeral
        if (::bind(listen_fd_, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
            err = std::string("bind(127.0.0.1:0) failed: ") + strerror(errno);
            ::close(listen_fd_);
            listen_fd_ = -1;
            return false;
        }
        if (::listen(listen_fd_, 8) != 0) {
            err = std::string("listen() failed: ") + strerror(errno);
            ::close(listen_fd_);
            listen_fd_ = -1;
            return false;
        }
        sockaddr_in bound{};
        socklen_t bound_len = sizeof(bound);
        if (::getsockname(listen_fd_, reinterpret_cast<sockaddr*>(&bound), &bound_len) != 0) {
            err = "getsockname() failed";
            ::close(listen_fd_);
            listen_fd_ = -1;
            return false;
        }
        port_ = ntohs(bound.sin_port);

        // 32 random bytes, hex-encoded (64 chars)
        std::random_device rd;
        unsigned char raw[32];
        for (auto& b : raw) b = static_cast<unsigned char>(rd());
        static const char* hex = "0123456789abcdef";
        token_.reserve(64);
        for (unsigned char b : raw) {
            token_.push_back(hex[b >> 4]);
            token_.push_back(hex[b & 0xf]);
        }

        stop_ = false;
        thread_ = std::thread([this] { accept_loop(); });
        fprintf(stderr, "[http] loopback transport on 127.0.0.1:%u (token %s...)\n",
                port_, token_.substr(0, 6).c_str());
        return true;
    }

    int port() const { return port_; }
    const std::string& token() const { return token_; }

    void stop() {
        if (listen_fd_ >= 0) {
            stop_ = true;
            ::shutdown(listen_fd_, SHUT_RDWR);
            ::close(listen_fd_);
            listen_fd_ = -1;
        }
        // Wake a handler thread parked in recv() on an accepted keep-alive
        // connection: closing the listen socket cannot do that, and without
        // this the idle reaper's join() would wait out the browser's socket
        // pool eviction (minutes) with all VRAM allocations still pinned.
        const int conn = conn_fd_.exchange(-1, std::memory_order_relaxed);
        if (conn >= 0) ::shutdown(conn, SHUT_RDWR);
        if (thread_.joinable()) thread_.join();
    }

private:
    static constexpr long long MAX_BODY = 64 * 1024 * 1024; // 4096x4096 RGBA8
    static constexpr int MAX_FRAME_DIM = 4096;
    // Per-request read budget (request line + headers + body) in ms.
    static constexpr uint64_t REQUEST_BUDGET_MS = 30'000;

    UpscaleHandler handler_;
    int listen_fd_ = -1;
    int port_ = 0;
    std::string token_;
    std::thread thread_;
    std::atomic<bool> stop_{false};
    // The connection currently served by the accept thread (-1 when none).
    // stop() shuts it down to unblock a recv() parked on an idle socket.
    std::atomic<int> conn_fd_{-1};

    void accept_loop() {
        while (!stop_) {
            int conn = ::accept(listen_fd_, nullptr, nullptr);
            if (conn < 0) {
                if (errno == EINTR) continue;
                break; // listener closed
            }
            conn_fd_.store(conn, std::memory_order_relaxed);
            handle_conn(conn);
            conn_fd_.store(-1, std::memory_order_relaxed);
            ::close(conn);
        }
    }

    // Buffered socket reader with line and exact-count primitives.
    // Every request runs against an absolute steady-clock deadline
    // (refreshed per request by handle_conn): a client that dribbles
    // headers or body bytes (slowloris) gets its connection closed
    // instead of pinning the single accept thread — and with it every
    // later frame — forever. Loopback-only, but a wedged page must not
    // wedge the host either.
    struct ConnBuf {
        int fd;
        const std::atomic<bool>* stop;
        std::vector<char> buf;
        size_t pos = 0;
        size_t len = 0;
        // Absolute steady-clock deadline in ms; UINT64_MAX = none.
        uint64_t deadline_ms = UINT64_MAX;

        explicit ConnBuf(int f, const std::atomic<bool>* stop_flag) : fd(f), stop(stop_flag), buf(64 * 1024) {}

        static uint64_t steady_ms() {
            return (uint64_t)std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now().time_since_epoch()).count();
        }

        bool fill() {
            if (pos > 0 && len > pos) {
                memmove(buf.data(), buf.data() + pos, len - pos);
                len -= pos;
                pos = 0;
            } else if (pos == len) {
                pos = 0;
                len = 0;
            }
            if (len == buf.size()) return false; // line longer than the buffer
            for (;;) {
                // Poll with a timeout instead of blocking in recv(): stop()
                // tears down the sockets, but only a poll (or the conn
                // shutdown in stop()) can wake this thread on an idle
                // keep-alive connection. The per-request deadline bounds
                // this the same way for dribbled requests.
                if (stop->load(std::memory_order_relaxed)) return false;
                const uint64_t now = steady_ms();
                if (now >= deadline_ms) return false;
                const uint64_t remain = deadline_ms - now;
                pollfd pfd{};
                pfd.fd = fd;
                pfd.events = POLLIN;
                // Slice at 100 ms so the stop flag stays responsive even
                // with a far deadline; remain > 0 holds (checked above).
                const int pr = ::poll(&pfd, 1, remain > 100 ? 100 : (int)remain);
                if (pr < 0) {
                    if (errno == EINTR) continue;
                    return false;
                }
                if (pr == 0) continue; // timeout: re-check the stop flag
                if (!(pfd.revents & POLLIN)) return false; // POLLERR/POLLHUP/POLLNVAL
                const ssize_t r = ::recv(fd, buf.data() + len, buf.size() - len, 0);
                if (r <= 0) return false;
                len += static_cast<size_t>(r);
                return true;
            }
        }

        // One LF- (or CRLF-) terminated line, terminator stripped.
        bool read_line(std::string& line) {
            line.clear();
            for (;;) {
                for (size_t i = pos; i < len; ++i) {
                    if (buf[i] == '\n') {
                        size_t e = i;
                        if (e > pos && buf[e - 1] == '\r') --e;
                        line.assign(buf.data() + pos, e - pos);
                        pos = i + 1;
                        return true;
                    }
                }
                if (!fill()) return false;
            }
        }

        bool read_exact(std::vector<unsigned char>& out, size_t n) {
            out.reserve(out.size() + n);
            while (n > 0) {
                if (pos == len && !fill()) return false;
                size_t take = n < len - pos ? n : len - pos;
                out.insert(out.end(), buf.data() + pos, buf.data() + pos + take);
                pos += take;
                n -= take;
            }
            return true;
        }
    };

    // "w=640&h=360&token=...&tw=..&th=..&engine=srvgg" -> values by key.
    // engine selects the inference backend per request ("" = default ncnn,
    // "srvgg" = hand-written Vulkan SRVGG); unknown values fall back to "".
    static void parse_query(const std::string& query, std::string& token, int& w, int& h,
                            int& tw, int& th, std::string& engine) {
        size_t start = 0;
        while (start <= query.size()) {
            size_t amp = query.find('&', start);
            std::string pair = query.substr(start, amp == std::string::npos ? std::string::npos : amp - start);
            size_t eq = pair.find('=');
            if (eq != std::string::npos) {
                const std::string key = pair.substr(0, eq);
                const std::string value = pair.substr(eq + 1);
                if (key == "token") token = value;
                else if (key == "w") w = atoi(value.c_str());
                else if (key == "h") h = atoi(value.c_str());
                else if (key == "tw") tw = atoi(value.c_str());
                else if (key == "th") th = atoi(value.c_str());
                else if (key == "engine") engine = value;
            }
            if (amp == std::string::npos) break;
            start = amp + 1;
        }
    }

    void handle_conn(int fd) {
        ConnBuf conn(fd, &stop_);
        // Keep-alive: serve sequential requests on this connection.
        for (;;) {
            // Fresh read budget per request (covers request line + headers
            // + body, not the inference itself): 64 MiB cross loopback in
            // milliseconds, so 30 s only ever fires on a dribbled socket.
            conn.deadline_ms = ConnBuf::steady_ms() + REQUEST_BUDGET_MS;
            std::string request_line;
            if (!conn.read_line(request_line)) return;

            // "POST /upscale?token=..&w=..&h=.. HTTP/1.1"
            std::string method, target;
            {
                size_t sp1 = request_line.find(' ');
                size_t sp2 = sp1 == std::string::npos ? std::string::npos : request_line.find(' ', sp1 + 1);
                if (sp1 == std::string::npos || sp2 == std::string::npos) {
                    write_response(fd, 400, "malformed request line", nullptr, 0, 0, 0, false);
                    return;
                }
                method = request_line.substr(0, sp1);
                target = request_line.substr(sp1 + 1, sp2 - sp1 - 1);
            }
            const bool is_options = method == "OPTIONS";
            const bool is_post = method == "POST";

            std::string path, query;
            size_t qmark = target.find('?');
            if (qmark == std::string::npos) path = target;
            else {
                path = target.substr(0, qmark);
                query = target.substr(qmark + 1);
            }
            std::string query_token;
            int qwidth = 0, qheight = 0, qtw = 0, qth = 0;
            std::string qengine;
            parse_query(query, query_token, qwidth, qheight, qtw, qth, qengine);

            long long content_length = -1;
            int width = qwidth, height = qheight;
            bool keep_alive = true;

            std::string line;
            while (conn.read_line(line)) {
                if (line.empty()) break; // end of headers
                auto colon = line.find(':');
                if (colon == std::string::npos) continue;
                std::string key = line.substr(0, colon);
                for (auto& c : key) c = static_cast<char>(::tolower(static_cast<unsigned char>(c)));
                size_t vs = colon + 1;
                while (vs < line.size() && line[vs] == ' ') ++vs;
                const std::string value = line.substr(vs);
                if (key == "content-length") content_length = atoll(value.c_str());
                else if (key == "x-frame-width" && width == 0) width = atoi(value.c_str());
                else if (key == "x-frame-height" && height == 0) height = atoi(value.c_str());
                else if (key == "connection") {
                    std::string v = value;
                    for (auto& c : v) c = static_cast<char>(::tolower(static_cast<unsigned char>(c)));
                    keep_alive = v.find("close") == std::string::npos;
                }
            }

            if (is_options) {
                // Preflight fallback for clients that do send custom headers.
                write_response(fd, 204, "", nullptr, 0, 0, 0, keep_alive);
                if (!keep_alive) return;
                continue;
            }

            if (!is_post || path != "/upscale") {
                write_response(fd, 404, "not found", nullptr, 0, 0, 0, false);
                return;
            }
            if (query_token != token_) {
                write_response(fd, 403, "forbidden", nullptr, 0, 0, 0, false);
                return;
            }
            if (width <= 0 || height <= 0 || width > MAX_FRAME_DIM || height > MAX_FRAME_DIM
                || content_length != static_cast<long long>(width) * height * 4) {
                write_response(fd, 400, "bad request: width/height/content-length mismatch",
                               nullptr, 0, 0, 0, false);
                return;
            }
            if (content_length > MAX_BODY) {
                write_response(fd, 413, "payload too large", nullptr, 0, 0, 0, false);
                return;
            }

            std::vector<unsigned char> body;
            if (!conn.read_exact(body, static_cast<size_t>(content_length))) return;

            std::vector<unsigned char> out;
            int out_w = 0, out_h = 0;
            std::string err;
            const int rc = handler_(body.data(), width, height, qtw, qth, out, out_w, out_h, err, qengine);
            if (rc != 0) {
                write_response(fd, 500, "upscale failed: " + err, nullptr, 0, 0, 0, false);
                return;
            }
            write_response(fd, 200, "", out.data(), static_cast<long long>(out.size()),
                           out_w, out_h, keep_alive);
            if (!keep_alive) return;
        }
    }

    bool send_all(int fd, const char* data, size_t n) {
        size_t off = 0;
        while (off < n) {
            ssize_t w = ::send(fd, data + off, n - off, MSG_NOSIGNAL);
            if (w <= 0) {
                if (w < 0 && errno == EINTR) continue;
                return false;
            }
            off += static_cast<size_t>(w);
        }
        return true;
    }

    void write_response(int fd, int status, const std::string& text,
                        const unsigned char* body, long long body_len,
                        int out_w, int out_h, bool keep_alive) {
        const bool has_text = !text.empty() && status != 200 && status != 204;
        char head[640];
        int n = snprintf(head, sizeof(head),
            "HTTP/1.1 %d %s\r\n"
            "Content-Type: application/octet-stream\r\n"
            "Content-Length: %lld\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Headers: Content-Type, X-AniWebScale-Token, X-Frame-Width, X-Frame-Height\r\n"
            "Access-Control-Allow-Methods: POST, OPTIONS\r\n"
            "Access-Control-Allow-Private-Network: true\r\n"
            // Firefox exposes only CORS-safelisted response headers to content
            // scripts unless they are listed here (X-Frame-Width/Height would
            // otherwise read as null and the client cannot validate the size).
            "Access-Control-Expose-Headers: X-Frame-Width, X-Frame-Height\r\n"
            "Access-Control-Max-Age: 86400\r\n"
            "X-Frame-Width: %d\r\n"
            "X-Frame-Height: %d\r\n"
            "Connection: %s\r\n"
            "\r\n",
            status,
            status == 200 ? "OK" : status == 204 ? "No Content" : text.c_str(),
            body != nullptr && body_len > 0 ? body_len : (has_text ? static_cast<long long>(text.size()) : 0),
            out_w, out_h,
            keep_alive ? "keep-alive" : "close");
        if (n <= 0 || n >= static_cast<int>(sizeof(head))) {
            // Over-long reason phrase (deep srvgg model dir on the 500
            // path): sending n bytes would over-read the stack buffer and
            // desync the client. Fail closed with a minimal head instead.
            const char* fallback = "HTTP/1.1 500 Internal Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            send_all(fd, fallback, strlen(fallback));
            return;
        }
        if (!send_all(fd, head, static_cast<size_t>(n))) return;
        if (body != nullptr && body_len > 0) send_all(fd, reinterpret_cast<const char*>(body), static_cast<size_t>(body_len));
        else if (has_text) send_all(fd, text.data(), text.size());
    }
};

} // namespace aniwebscale
