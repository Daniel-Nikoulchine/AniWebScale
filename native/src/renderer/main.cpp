#include "capture_renderer.hpp"

#include "anime4k/json.hpp"
#include "anime4k/protocol.hpp"
#include "anime4k/win32_util.hpp"

#include <Windows.h>
#include <shellapi.h>

#include <algorithm>
#include <atomic>
#include <cstddef>
#include <cwchar>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>

namespace {

constexpr UINT kCommandMessage = WM_APP + 1;
constexpr UINT kPipeClosedMessage = WM_APP + 2;

class UniqueHandle {
 public:
  UniqueHandle() = default;
  explicit UniqueHandle(HANDLE handle) : handle_(handle) {}
  ~UniqueHandle() { reset(); }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept : handle_(other.release()) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other) reset(other.release());
    return *this;
  }
  [[nodiscard]] HANDLE get() const noexcept { return handle_; }
  [[nodiscard]] explicit operator bool() const noexcept { return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE; }
  [[nodiscard]] HANDLE release() noexcept {
    const HANDLE result = handle_;
    handle_ = nullptr;
    return result;
  }
  void reset(HANDLE replacement = nullptr) noexcept {
    if (handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE) CloseHandle(handle_);
    handle_ = replacement;
  }

 private:
  HANDLE handle_{};
};

struct Arguments {
  std::wstring pipe;
  DWORD parent_process_id{};
};

std::optional<Arguments> parse_arguments(int count, wchar_t** values) {
  Arguments arguments;
  for (int index = 1; index < count; ++index) {
    const std::wstring_view value(values[index]);
    if (value == L"--pipe" && index + 1 < count) {
      arguments.pipe = values[++index];
    } else if (value == L"--parent" && index + 1 < count) {
      const std::wstring_view raw(values[++index]);
      wchar_t* end = nullptr;
      const unsigned long parsed = std::wcstoul(raw.data(), &end, 10);
      if (end == raw.data() || *end != L'\0' || parsed == 0 || parsed > MAXDWORD) return std::nullopt;
      arguments.parent_process_id = static_cast<DWORD>(parsed);
    } else {
      return std::nullopt;
    }
  }
  if (arguments.pipe.empty() || arguments.parent_process_id == 0) return std::nullopt;
  return arguments;
}

bool validate_host_process(DWORD process_id) {
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE, process_id);
  if (process == nullptr) return false;
  wchar_t path[32768]{};
  DWORD size = static_cast<DWORD>(std::size(path));
  const bool success = QueryFullProcessImageNameW(process, 0, path, &size) != FALSE && WaitForSingleObject(process, 0) == WAIT_TIMEOUT;
  CloseHandle(process);
  if (!success) return false;
  std::wstring_view full_path(path, size);
  const auto slash = full_path.find_last_of(L"\\/");
  const std::wstring_view name = slash == std::wstring_view::npos ? full_path : full_path.substr(slash + 1);
  return _wcsicmp(std::wstring(name).c_str(), L"Anime4K.NativeHost.exe") == 0;
}

bool validate_pipe_name(const std::wstring& pipe, DWORD parent_process_id) {
  const std::wstring sid = anime4k::win32::current_user_sid();
  if (sid.empty()) return false;
  const std::wstring prefix = L"\\\\.\\pipe\\Anime4K.Native." + sid + L"." + std::to_wstring(parent_process_id) + L".";
  if (!pipe.starts_with(prefix) || pipe.size() <= prefix.size()) return false;
  return std::all_of(pipe.begin() + static_cast<std::ptrdiff_t>(prefix.size()), pipe.end(), [](wchar_t character) {
    return character >= L'0' && character <= L'9';
  });
}

std::optional<UniqueHandle> connect_pipe(const std::wstring& name) {
  for (int attempt = 0; attempt < 50; ++attempt) {
    HANDLE pipe = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, nullptr);
    if (pipe != INVALID_HANDLE_VALUE) return UniqueHandle(pipe);
    if (GetLastError() != ERROR_PIPE_BUSY) return std::nullopt;
    if (!WaitNamedPipeW(name.c_str(), 100)) return std::nullopt;
  }
  return std::nullopt;
}

std::optional<std::string> string_property(const anime4k::json::Object& object, std::string_view key) {
  return anime4k::protocol::get_string(object, key);
}

class RendererApplication {
 public:
  RendererApplication(UniqueHandle pipe, DWORD main_thread)
      : pipe_(std::move(pipe)),
        main_thread_(main_thread),
        capture_([this](anime4k::json::Value event) { send(std::move(event)); }) {}

  ~RendererApplication() {
    running_.store(false, std::memory_order_release);
    capture_.stop("renderer_shutdown");
    if (reader_.joinable()) {
      CancelIoEx(pipe_.get(), nullptr);
      reader_.join();
    }
  }

  void start_reader() {
    reader_ = std::thread([this]() { reader_loop(); });
  }

  int message_loop() {
    MSG message{};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) {
      if (message.hwnd == nullptr && message.message == kCommandMessage) {
        std::unique_ptr<anime4k::json::Value> command(reinterpret_cast<anime4k::json::Value*>(message.lParam));
        dispatch(*command);
      } else if (message.hwnd == nullptr &&
                 message.message == anime4k::renderer::CaptureRenderer::kCaptureClosedMessage) {
        capture_.handle_capture_closed(static_cast<std::uint64_t>(message.wParam));
      } else if (message.hwnd == nullptr &&
                 message.message == anime4k::renderer::CaptureRenderer::kCaptureResizeDispatchFailedMessage) {
        capture_.handle_capture_resize_dispatch_failure(static_cast<std::uint64_t>(message.wParam));
      } else if (message.hwnd == nullptr && message.message == kPipeClosedMessage) {
        break;
      } else {
        TranslateMessage(&message);
        DispatchMessageW(&message);
      }
    }
    running_.store(false, std::memory_order_release);
    capture_.stop("native_host_disconnected");
    return 0;
  }

 private:
  void reader_loop() {
    while (running_.load(std::memory_order_acquire)) {
      std::string payload;
      std::string error;
      const auto read = anime4k::protocol::read_framed_message_overlapped(pipe_.get(), payload, error);
      if (read != anime4k::protocol::ReadResult::message) break;
      anime4k::win32::debug_log("renderer", "received host request");
      auto parsed = anime4k::json::parse(payload);
      if (!parsed.value.has_value()) {
        send(anime4k::protocol::make_error("invalid_json", parsed.error, std::nullopt, std::nullopt, false));
        continue;
      }
      const auto validation = anime4k::protocol::validate_browser_request(*parsed.value);
      if (!validation.valid) {
        const auto* object = parsed.value->as_object();
        send(anime4k::protocol::make_error(
            validation.code,
            validation.message,
            object == nullptr ? std::nullopt : string_property(*object, "requestId"),
            object == nullptr ? std::nullopt : string_property(*object, "sessionId"),
            false));
        continue;
      }
      auto* command = new anime4k::json::Value(std::move(*parsed.value));
      if (!PostThreadMessageW(main_thread_, kCommandMessage, 0, reinterpret_cast<LPARAM>(command))) {
        delete command;
        break;
      }
      anime4k::win32::debug_log("renderer", "posted request to UI thread");
    }
    PostThreadMessageW(main_thread_, kPipeClosedMessage, 0, 0);
  }

  void send(anime4k::json::Value event) {
    const auto validation = anime4k::protocol::validate_renderer_event(event);
    if (!validation.valid) {
      event = anime4k::protocol::make_error("internal_protocol_error", validation.message, std::nullopt, std::nullopt, false);
    }
    std::string error;
    const auto payload = anime4k::json::stringify(event);
    anime4k::win32::debug_log("renderer", "sending event");
    if (!anime4k::protocol::write_framed_message_overlapped(pipe_.get(), payload, &write_mutex_, error)) {
      anime4k::win32::debug_log("renderer", "event write failed: " + error);
      running_.store(false, std::memory_order_release);
    } else {
      anime4k::win32::debug_log("renderer", "event sent");
    }
  }

  void send_status(const std::string& request_id, const std::string& session_id, std::string state, std::string message) {
    send(anime4k::json::Object{
        {"type", "status"},
        {"protocolVersion", static_cast<int>(anime4k::protocol::kProtocolVersion)},
        {"requestId", request_id},
        {"sessionId", session_id},
        {"state", std::move(state)},
        {"message", std::move(message)},
    });
  }

  void send_request_error(
      const anime4k::json::Object& object, std::string code, std::string message, bool recoverable = false) {
    send(anime4k::protocol::make_error(
        std::move(code),
        std::move(message),
        string_property(object, "requestId"),
        string_property(object, "sessionId"),
        recoverable));
  }

  bool session_matches(const anime4k::json::Object& object) {
    const auto session = string_property(object, "sessionId");
    return session.has_value() && capture_.active() && *session == capture_.session_id();
  }

  void dispatch(const anime4k::json::Value& command) {
    const auto& object = *command.as_object();
    const auto type = *string_property(object, "type");
    const auto request_id = *string_property(object, "requestId");
    anime4k::win32::debug_log("renderer", "dispatching " + type);
    if (type == "hello") {
      send(anime4k::json::Object{
          {"type", "ready"},
          {"protocolVersion", static_cast<int>(anime4k::protocol::kProtocolVersion)},
          {"requestId", request_id},
      });
      return;
    }
    if (type == "capabilities") {
      send(anime4k::json::Object{
          {"type", "capabilities"},
          {"protocolVersion", static_cast<int>(anime4k::protocol::kProtocolVersion)},
          {"requestId", request_id},
          {"windowsCapture", winrt::Windows::Graphics::Capture::GraphicsCaptureSession::IsSupported()},
          {"d3d11", true},
          {"modes", anime4k::json::Array{
              "OFF", "A", "B", "C", "AA", "BB", "CA", "CNNX2",
              "ARTCNN", "ACNET", "ARNET", "ANIMEJANAI"}},
          {"qualities", anime4k::json::Array{"M", "VL", "UL"}},
          {"frameGeneration", true},
      });
      return;
    }
    if (type == "start") {
      if (capture_.active()) {
        send_request_error(object, "session_active", "a native capture session is already active", true);
        return;
      }
      anime4k::renderer::StartOptions options;
      options.session_id = *string_property(object, "sessionId");
      options.window_nonce = *string_property(object, "windowNonce");
      options.mode = *string_property(object, "mode");
      options.quality = *string_property(object, "quality");
      options.target_width = static_cast<std::uint32_t>(anime4k::protocol::get_number(object, "targetWidth").value_or(0.0));
      options.target_height = static_cast<std::uint32_t>(anime4k::protocol::get_number(object, "targetHeight").value_or(0.0));
      options.capture_x = static_cast<std::uint32_t>(anime4k::protocol::get_number(object, "captureX").value_or(0.0));
      options.capture_y = static_cast<std::uint32_t>(anime4k::protocol::get_number(object, "captureY").value_or(0.0));
      options.capture_width = static_cast<std::uint32_t>(anime4k::protocol::get_number(object, "captureWidth").value_or(0.0));
      options.capture_height = static_cast<std::uint32_t>(anime4k::protocol::get_number(object, "captureHeight").value_or(0.0));
      options.frame_generation_enabled = anime4k::protocol::get_bool(object, "frameGenerationEnabled").value_or(false);
      std::string error;
      if (!capture_.start(options, error)) {
        send_request_error(object, "capture_start_failed", error, false);
        return;
      }
      send_status(request_id, options.session_id, "capturing", capture_.state_message());
      return;
    }
    if (type == "status") {
      const auto session = *string_property(object, "sessionId");
      if (capture_.active() && session != capture_.session_id()) {
        send_request_error(object, "session_mismatch", "the requested session is not active", true);
        return;
      }
      const auto playback_active = anime4k::protocol::get_bool(object, "playbackActive");
      const auto media_time = anime4k::protocol::get_number(object, "mediaTime");
      if (playback_active.has_value() && media_time.has_value()) {
        capture_.update_playback_state(*playback_active, *media_time);
      }
      send_status(request_id, session, capture_.active() ? "capturing" : "stopped", capture_.state_message());
      return;
    }
    if (type == "updateConfiguration") {
      if (!session_matches(object)) {
        send_request_error(object, "session_mismatch", "the requested session is not active", true);
        return;
      }
      capture_.update_configuration(
          *string_property(object, "mode"),
          *string_property(object, "quality"),
          anime4k::protocol::get_bool(object, "frameGenerationEnabled").value_or(false));
      send_status(request_id, capture_.session_id(), "capturing", capture_.state_message());
      return;
    }
    if (type == "stop") {
      const auto session = *string_property(object, "sessionId");
      if (capture_.active() && session != capture_.session_id()) {
        send_request_error(object, "session_mismatch", "the requested session is not active", true);
        return;
      }
      capture_.stop("requested");
      send(anime4k::json::Object{
          {"type", "stopped"},
          {"protocolVersion", static_cast<int>(anime4k::protocol::kProtocolVersion)},
          {"requestId", request_id},
          {"sessionId", session},
          {"reason", "requested"},
      });
      return;
    }
    send_request_error(object, "unsupported_direction", type + " is emitted by the renderer and is not accepted as an input command", true);
  }

  UniqueHandle pipe_;
  DWORD main_thread_{};
  std::atomic_bool running_{true};
  std::mutex write_mutex_;
  std::thread reader_;
  anime4k::renderer::CaptureRenderer capture_;
};

}  // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  winrt::init_apartment(winrt::apartment_type::multi_threaded);

  int argument_count = 0;
  wchar_t** argument_values = CommandLineToArgvW(GetCommandLineW(), &argument_count);
  if (argument_values == nullptr) return 2;
  const auto arguments = parse_arguments(argument_count, argument_values);
  LocalFree(argument_values);
  if (!arguments.has_value() || !validate_pipe_name(arguments->pipe, arguments->parent_process_id) ||
      !validate_host_process(arguments->parent_process_id)) {
    return 3;
  }

  auto pipe = connect_pipe(arguments->pipe);
  if (!pipe.has_value()) return 4;
  anime4k::win32::debug_log("renderer", "connected to host pipe");
  MSG initialize_queue{};
  PeekMessageW(&initialize_queue, nullptr, WM_USER, WM_USER, PM_NOREMOVE);
  RendererApplication application(std::move(*pipe), GetCurrentThreadId());
  application.start_reader();
  return application.message_loop();
}
