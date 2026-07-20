#include "anime4k/json.hpp"
#include "anime4k/protocol.hpp"
#include "anime4k/win32_util.hpp"

#include <Windows.h>
#include <fcntl.h>
#include <io.h>
#include <sddl.h>

#include <algorithm>
#include <atomic>
#include <filesystem>
#include <iostream>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace {

using anime4k::json::Object;
using anime4k::json::Value;

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

std::optional<std::vector<std::string>> load_allowed_callers() {
  const auto path = (std::filesystem::path(anime4k::win32::executable_directory()) / L"native-host-allowlist.json").wstring();
  const auto contents = anime4k::win32::read_text_file(path);
  if (!contents.has_value()) return std::nullopt;
  const auto parsed = anime4k::json::parse(*contents);
  if (!parsed.value.has_value() || !parsed.value->is_object()) return std::nullopt;
  const auto* allowed = anime4k::json::find(*parsed.value->as_object(), "allowedCallers");
  if (allowed == nullptr || !allowed->is_array()) return std::nullopt;
  std::vector<std::string> callers;
  for (const auto& item : *allowed->as_array()) {
    const auto* caller = item.as_string();
    if (caller == nullptr || caller->empty() || caller->size() > 256) return std::nullopt;
    callers.push_back(*caller);
  }
  if (callers.empty()) return std::nullopt;
  return callers;
}

bool validate_caller(int argument_count, wchar_t** arguments) {
  const auto callers = load_allowed_callers();
  if (!callers.has_value()) return false;
  for (int index = 1; index < argument_count; ++index) {
    const std::string argument = anime4k::win32::wide_to_utf8(arguments[index]);
    if (std::find(callers->begin(), callers->end(), argument) != callers->end()) return true;
  }
  return false;
}

std::optional<UniqueHandle> create_secure_pipe(std::wstring& pipe_name, std::string& error) {
  const std::wstring sid = anime4k::win32::current_user_sid();
  if (sid.empty()) {
    error = "could not resolve current user SID";
    return std::nullopt;
  }
  pipe_name = L"\\\\.\\pipe\\Anime4K.Native." + sid + L"." + std::to_wstring(GetCurrentProcessId()) + L"." + std::to_wstring(GetTickCount64());
  const std::wstring descriptor = L"D:P(A;;GA;;;SY)(A;;GA;;;" + sid + L")";
  PSECURITY_DESCRIPTOR security_descriptor = nullptr;
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
          descriptor.c_str(), SDDL_REVISION_1, &security_descriptor, nullptr)) {
    error = "could not build pipe security descriptor: " + anime4k::win32::last_error_message();
    return std::nullopt;
  }
  SECURITY_ATTRIBUTES security_attributes{};
  security_attributes.nLength = sizeof(security_attributes);
  security_attributes.lpSecurityDescriptor = security_descriptor;
  security_attributes.bInheritHandle = FALSE;
  const HANDLE pipe = CreateNamedPipeW(
      pipe_name.c_str(),
      PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE | FILE_FLAG_OVERLAPPED,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
      1,
      anime4k::protocol::kMaximumMessageBytes + 4,
      anime4k::protocol::kMaximumMessageBytes + 4,
      5000,
      &security_attributes);
  LocalFree(security_descriptor);
  if (pipe == INVALID_HANDLE_VALUE) {
    error = "CreateNamedPipe failed: " + anime4k::win32::last_error_message();
    return std::nullopt;
  }
  return UniqueHandle(pipe);
}

struct RendererProcess {
  UniqueHandle process;
  UniqueHandle thread;
  UniqueHandle job;
};

std::optional<RendererProcess> launch_renderer(const std::wstring& pipe_name, std::string& error) {
  const auto renderer_path = std::filesystem::path(anime4k::win32::executable_directory()) / L"Anime4K.Renderer.exe";
  if (!std::filesystem::is_regular_file(renderer_path)) {
    error = "Anime4K.Renderer.exe is missing beside the native host";
    return std::nullopt;
  }

  UniqueHandle job(CreateJobObjectW(nullptr, nullptr));
  if (!job) {
    error = "CreateJobObject failed: " + anime4k::win32::last_error_message();
    return std::nullopt;
  }
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION job_information{};
  job_information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!SetInformationJobObject(job.get(), JobObjectExtendedLimitInformation, &job_information, sizeof(job_information))) {
    error = "SetInformationJobObject failed: " + anime4k::win32::last_error_message();
    return std::nullopt;
  }

  std::wstring command_line = L"\"" + renderer_path.wstring() + L"\" --pipe \"" + pipe_name + L"\" --parent " + std::to_wstring(GetCurrentProcessId());
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process_information{};
  if (!CreateProcessW(
          renderer_path.c_str(),
          command_line.data(),
          nullptr,
          nullptr,
          FALSE,
          CREATE_NO_WINDOW,
          nullptr,
          renderer_path.parent_path().c_str(),
          &startup,
          &process_information)) {
    error = "CreateProcess for renderer failed: " + anime4k::win32::last_error_message();
    return std::nullopt;
  }
  RendererProcess result{
      UniqueHandle(process_information.hProcess),
      UniqueHandle(process_information.hThread),
      std::move(job),
  };
  if (!AssignProcessToJobObject(result.job.get(), result.process.get())) {
    error = "AssignProcessToJobObject failed: " + anime4k::win32::last_error_message();
    TerminateProcess(result.process.get(), 1);
    return std::nullopt;
  }
  return result;
}

std::optional<std::string> property_string(const Value& value, std::string_view key) {
  if (!value.is_object()) return std::nullopt;
  return anime4k::protocol::get_string(*value.as_object(), key);
}

void send_error_to_browser(
    HANDLE output,
    std::mutex& output_mutex,
    std::string code,
    std::string message,
    const std::optional<std::string>& request_id = std::nullopt,
    const std::optional<std::string>& session_id = std::nullopt) {
  std::string write_error;
  const auto payload = anime4k::json::stringify(anime4k::protocol::make_error(
      std::move(code), std::move(message), request_id, session_id, false));
  (void)anime4k::protocol::write_framed_message(output, payload, &output_mutex, write_error);
}

int run_host() {
  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  if (input == INVALID_HANDLE_VALUE || output == INVALID_HANDLE_VALUE || input == nullptr || output == nullptr) return 2;

  std::mutex output_mutex;
  std::wstring pipe_name;
  std::string error;
  auto pipe = create_secure_pipe(pipe_name, error);
  if (!pipe.has_value()) {
    send_error_to_browser(output, output_mutex, "native_host_start_failed", error);
    return 3;
  }
  auto renderer = launch_renderer(pipe_name, error);
  if (!renderer.has_value()) {
    send_error_to_browser(output, output_mutex, "native_renderer_start_failed", error);
    return 4;
  }
  OVERLAPPED connect_operation{};
  UniqueHandle connect_event(CreateEventW(nullptr, TRUE, FALSE, nullptr));
  if (!connect_event) {
    send_error_to_browser(output, output_mutex, "native_renderer_connect_failed", anime4k::win32::last_error_message());
    return 5;
  }
  connect_operation.hEvent = connect_event.get();
  if (!ConnectNamedPipe(pipe->get(), &connect_operation)) {
    const DWORD connect_error = GetLastError();
    if (connect_error == ERROR_IO_PENDING) {
      DWORD transferred = 0;
      if (WaitForSingleObject(connect_event.get(), 5000) != WAIT_OBJECT_0 ||
          !GetOverlappedResult(pipe->get(), &connect_operation, &transferred, FALSE)) {
        send_error_to_browser(output, output_mutex, "native_renderer_connect_failed", anime4k::win32::last_error_message());
        return 5;
      }
    } else if (connect_error != ERROR_PIPE_CONNECTED) {
      send_error_to_browser(output, output_mutex, "native_renderer_connect_failed", anime4k::win32::last_error_message(connect_error));
      return 5;
    }
  }
  anime4k::win32::debug_log("host", "renderer connected");

  std::atomic_bool relay_running{true};
  UniqueHandle main_thread_handle(OpenThread(THREAD_TERMINATE, FALSE, GetCurrentThreadId()));
  std::thread relay([&]() {
    while (relay_running.load(std::memory_order_relaxed)) {
      std::string payload;
      std::string relay_error;
      const auto read = anime4k::protocol::read_framed_message_overlapped(pipe->get(), payload, relay_error);
      if (read != anime4k::protocol::ReadResult::message) {
        anime4k::win32::debug_log("host", "renderer relay stopped: " + relay_error);
        if (relay_running.exchange(false, std::memory_order_acq_rel)) {
          send_error_to_browser(output, output_mutex, "renderer_disconnected", "The AniWebScale native renderer disconnected unexpectedly.");
          if (main_thread_handle) CancelSynchronousIo(main_thread_handle.get());
        }
        break;
      }
      anime4k::win32::debug_log("host", "received renderer event");
      const auto parsed = anime4k::json::parse(payload);
      if (!parsed.value.has_value()) {
        send_error_to_browser(output, output_mutex, "renderer_protocol_error", "renderer emitted invalid JSON");
        continue;
      }
      const auto validation = anime4k::protocol::validate_renderer_event(*parsed.value);
      if (!validation.valid) {
        send_error_to_browser(output, output_mutex, "renderer_protocol_error", validation.message);
        continue;
      }
      if (!anime4k::protocol::write_framed_message(output, payload, &output_mutex, relay_error)) break;
    }
    relay_running.store(false, std::memory_order_release);
    anime4k::win32::debug_log("host", "renderer relay thread exited");
  });

  int exit_code = 0;
  while (relay_running.load(std::memory_order_relaxed)) {
    std::string payload;
    const auto read = anime4k::protocol::read_framed_message(input, payload, error);
    if (read == anime4k::protocol::ReadResult::end_of_stream) break;
    if (read == anime4k::protocol::ReadResult::error) {
      if (!relay_running.load(std::memory_order_acquire)) break;
      send_error_to_browser(output, output_mutex, "invalid_native_frame", error);
      exit_code = 6;
      break;
    }
    const auto parsed = anime4k::json::parse(payload);
    anime4k::win32::debug_log("host", "received browser request");
    if (!parsed.value.has_value()) {
      send_error_to_browser(output, output_mutex, "invalid_json", parsed.error + " at byte " + std::to_string(parsed.error_offset));
      continue;
    }
    const auto request_id = property_string(*parsed.value, "requestId");
    const auto session_id = property_string(*parsed.value, "sessionId");
    const auto validation = anime4k::protocol::validate_browser_request(*parsed.value);
    if (!validation.valid) {
      send_error_to_browser(output, output_mutex, validation.code, validation.message, request_id, session_id);
      continue;
    }
    if (!anime4k::protocol::write_framed_message_overlapped(pipe->get(), payload, nullptr, error)) {
      send_error_to_browser(output, output_mutex, "renderer_disconnected", error, request_id, session_id);
      exit_code = 7;
      break;
    }
    anime4k::win32::debug_log("host", "forwarded browser request");
  }

  relay_running.store(false, std::memory_order_relaxed);
  CancelIoEx(pipe->get(), nullptr);
  if (relay.joinable()) relay.join();
  FlushFileBuffers(pipe->get());
  DisconnectNamedPipe(pipe->get());
  return exit_code;
}

}  // namespace

int wmain(int argument_count, wchar_t** arguments) {
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  if (!validate_caller(argument_count, arguments)) return 10;
  return run_host();
}
