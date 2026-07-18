#include "anime4k/protocol.hpp"

#include "anime4k/win32_util.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <set>
#include <vector>

namespace anime4k::protocol {
namespace {

bool read_exact(HANDLE handle, void* buffer, std::uint32_t size, bool& clean_eof, std::string& error) {
  auto* bytes = static_cast<std::byte*>(buffer);
  std::uint32_t offset = 0;
  clean_eof = false;
  while (offset < size) {
    DWORD read = 0;
    if (!ReadFile(handle, bytes + offset, size - offset, &read, nullptr)) {
      const DWORD code = GetLastError();
      if (offset == 0 && (code == ERROR_BROKEN_PIPE || code == ERROR_HANDLE_EOF)) {
        clean_eof = true;
        return false;
      }
      error = "ReadFile failed: " + win32::last_error_message(code);
      return false;
    }
    if (read == 0) {
      clean_eof = offset == 0;
      if (!clean_eof) error = "unexpected end of framed message";
      return false;
    }
    offset += read;
  }
  return true;
}

bool write_exact(HANDLE handle, const void* buffer, std::uint32_t size, std::string& error) {
  const auto* bytes = static_cast<const std::byte*>(buffer);
  std::uint32_t offset = 0;
  while (offset < size) {
    DWORD written = 0;
    if (!WriteFile(handle, bytes + offset, size - offset, &written, nullptr)) {
      error = "WriteFile failed: " + win32::last_error_message();
      return false;
    }
    if (written == 0) {
      error = "WriteFile wrote zero bytes";
      return false;
    }
    offset += written;
  }
  return true;
}

bool read_exact_overlapped(HANDLE handle, void* buffer, std::uint32_t size, bool& clean_eof, std::string& error) {
  HANDLE event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (event == nullptr) {
    error = "CreateEvent failed: " + win32::last_error_message();
    return false;
  }
  auto* bytes = static_cast<std::byte*>(buffer);
  std::uint32_t offset = 0;
  clean_eof = false;
  while (offset < size) {
    OVERLAPPED operation{};
    operation.hEvent = event;
    DWORD transferred = 0;
    ResetEvent(event);
    BOOL started = ReadFile(handle, bytes + offset, size - offset, nullptr, &operation);
    if (!started) {
      const DWORD code = GetLastError();
      if (code != ERROR_IO_PENDING) {
        CloseHandle(event);
        if (offset == 0 && (code == ERROR_BROKEN_PIPE || code == ERROR_HANDLE_EOF)) clean_eof = true;
        else error = "overlapped ReadFile failed: " + win32::last_error_message(code);
        return false;
      }
      if (WaitForSingleObject(event, INFINITE) != WAIT_OBJECT_0 || !GetOverlappedResult(handle, &operation, &transferred, FALSE)) {
        const DWORD result = GetLastError();
        CloseHandle(event);
        if (offset == 0 && (result == ERROR_BROKEN_PIPE || result == ERROR_HANDLE_EOF)) clean_eof = true;
        else error = "overlapped read completion failed: " + win32::last_error_message(result);
        return false;
      }
    } else if (!GetOverlappedResult(handle, &operation, &transferred, FALSE)) {
      const DWORD result = GetLastError();
      CloseHandle(event);
      error = "overlapped read result failed: " + win32::last_error_message(result);
      return false;
    }
    if (transferred == 0) {
      CloseHandle(event);
      clean_eof = offset == 0;
      if (!clean_eof) error = "unexpected end of overlapped framed message";
      return false;
    }
    offset += transferred;
  }
  CloseHandle(event);
  return true;
}

bool write_exact_overlapped(HANDLE handle, const void* buffer, std::uint32_t size, std::string& error) {
  HANDLE event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (event == nullptr) {
    error = "CreateEvent failed: " + win32::last_error_message();
    return false;
  }
  const auto* bytes = static_cast<const std::byte*>(buffer);
  std::uint32_t offset = 0;
  while (offset < size) {
    OVERLAPPED operation{};
    operation.hEvent = event;
    DWORD transferred = 0;
    ResetEvent(event);
    BOOL started = WriteFile(handle, bytes + offset, size - offset, nullptr, &operation);
    if (!started) {
      const DWORD code = GetLastError();
      if (code != ERROR_IO_PENDING) {
        CloseHandle(event);
        error = "overlapped WriteFile failed: " + win32::last_error_message(code);
        return false;
      }
      if (WaitForSingleObject(event, INFINITE) != WAIT_OBJECT_0 || !GetOverlappedResult(handle, &operation, &transferred, FALSE)) {
        const DWORD result = GetLastError();
        CloseHandle(event);
        error = "overlapped write completion failed: " + win32::last_error_message(result);
        return false;
      }
    } else if (!GetOverlappedResult(handle, &operation, &transferred, FALSE)) {
      const DWORD result = GetLastError();
      CloseHandle(event);
      error = "overlapped write result failed: " + win32::last_error_message(result);
      return false;
    }
    if (transferred == 0) {
      CloseHandle(event);
      error = "overlapped WriteFile wrote zero bytes";
      return false;
    }
    offset += transferred;
  }
  CloseHandle(event);
  return true;
}

ValidationResult invalid(std::string code, std::string message) {
  return {false, std::move(code), std::move(message)};
}

bool is_identifier(std::string_view value) {
  if (value.empty() || value.size() > 128) return false;
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= 'A' && character <= 'Z') ||
           (character >= '0' && character <= '9') ||
           character == '.' || character == '_' || character == '-';
  });
}

bool has_valid_optional_identifier(const json::Object& object, std::string_view key) {
  const auto* value = json::find(object, key);
  if (value == nullptr) return true;
  const auto* identifier = value->as_string();
  return identifier != nullptr && is_identifier(*identifier);
}

bool has_valid_identifier(const json::Object& object, std::string_view key) {
  const auto identifier = get_string(object, key);
  return identifier.has_value() && is_identifier(*identifier);
}

bool is_session_state(std::string_view value) {
  return value == "starting" || value == "capturing" || value == "stopping" ||
      value == "stopped" || value == "failed";
}

bool is_nonce(std::string_view value) {
  return value.size() == 32 && std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= '0' && character <= '9') || (character >= 'a' && character <= 'f');
  });
}

bool is_integer_in_range(double value, int minimum, int maximum) {
  return std::isfinite(value) && std::floor(value) == value && value >= minimum && value <= maximum;
}

ValidationResult check_keys(
    const json::Object& object,
    std::initializer_list<std::string_view> required,
    std::initializer_list<std::string_view> optional = {}) {
  std::set<std::string, std::less<>> allowed;
  for (const auto key : required) allowed.emplace(key);
  for (const auto key : optional) allowed.emplace(key);
  for (const auto& [key, unused] : object) {
    (void)unused;
    if (!allowed.contains(key)) return invalid("invalid_schema", "unexpected property: " + key);
  }
  for (const auto key : required) {
    if (json::find(object, key) == nullptr) return invalid("invalid_schema", "missing property: " + std::string(key));
  }
  return {true, {}, {}};
}

ValidationResult validate_common(const json::Object& object, bool session_required) {
  const auto type = get_string(object, "type");
  const auto request = get_string(object, "requestId");
  const auto version = get_number(object, "protocolVersion");
  if (!type.has_value() || type->empty() || type->size() > 32) return invalid("invalid_schema", "type must be a short string");
  if (!request.has_value() || !is_identifier(*request)) return invalid("invalid_schema", "requestId must be a valid identifier");
  if (!version.has_value() || *version != static_cast<double>(kProtocolVersion)) return invalid("unsupported_protocol", "protocolVersion must be 3");
  if (session_required) {
    const auto session = get_string(object, "sessionId");
    if (!session.has_value() || !is_identifier(*session)) return invalid("invalid_schema", "sessionId must be a valid identifier");
  }
  return {true, {}, {}};
}

bool is_mode(std::string_view value) {
  static constexpr std::array<std::string_view, 11> modes{
      "OFF", "A", "B", "C", "AA", "BB", "CA", "CNNX2",
      "ARTCNN", "ACNET", "ARNET"};
  return std::find(modes.begin(), modes.end(), value) != modes.end();
}

bool is_quality(std::string_view value) {
  return value == "M" || value == "VL" || value == "UL";
}

ValidationResult validate_configuration(const json::Object& object) {
  const auto mode = get_string(object, "mode");
  const auto quality = get_string(object, "quality");
  const auto frame_generation = get_bool(object, "frameGenerationEnabled");
  if (!mode.has_value() || !is_mode(*mode)) {
    return invalid("invalid_configuration", "mode is not a supported enhancement mode");
  }
  if (!quality.has_value() || !is_quality(*quality)) {
    return invalid("invalid_configuration", "quality must be M, VL, or UL");
  }
  if (!frame_generation.has_value()) {
    return invalid("invalid_configuration", "frameGenerationEnabled must be boolean");
  }
  return {true, {}, {}};
}

bool array_matches(const json::Value* value, bool (*predicate)(std::string_view)) {
  if (value == nullptr) return false;
  const auto* array = value->as_array();
  if (array == nullptr || array->empty()) return false;
  return std::all_of(array->begin(), array->end(), [predicate](const json::Value& item) {
    const auto* text = item.as_string();
    return text != nullptr && predicate(*text);
  });
}

}  // namespace

ReadResult read_framed_message(HANDLE handle, std::string& payload, std::string& error) {
  payload.clear();
  error.clear();
  std::uint32_t length = 0;
  bool clean_eof = false;
  if (!read_exact(handle, &length, sizeof(length), clean_eof, error)) {
    return clean_eof ? ReadResult::end_of_stream : ReadResult::error;
  }
  if (length == 0 || length > kMaximumMessageBytes) {
    error = "invalid native message length: " + std::to_string(length);
    return ReadResult::error;
  }
  payload.resize(length);
  if (!read_exact(handle, payload.data(), length, clean_eof, error)) return ReadResult::error;
  return ReadResult::message;
}

bool write_framed_message(HANDLE handle, std::string_view payload, std::mutex* mutex, std::string& error) {
  if (payload.empty() || payload.size() > kMaximumMessageBytes || payload.size() > std::numeric_limits<std::uint32_t>::max()) {
    error = "payload length is outside the native messaging limit";
    return false;
  }
  const auto write = [&]() {
    const auto length = static_cast<std::uint32_t>(payload.size());
    return write_exact(handle, &length, sizeof(length), error) && write_exact(handle, payload.data(), length, error);
  };
  if (mutex == nullptr) return write();
  const std::scoped_lock lock(*mutex);
  return write();
}

ReadResult read_framed_message_overlapped(HANDLE handle, std::string& payload, std::string& error) {
  payload.clear();
  error.clear();
  std::uint32_t length = 0;
  bool clean_eof = false;
  if (!read_exact_overlapped(handle, &length, sizeof(length), clean_eof, error)) {
    return clean_eof ? ReadResult::end_of_stream : ReadResult::error;
  }
  if (length == 0 || length > kMaximumMessageBytes) {
    error = "invalid native message length: " + std::to_string(length);
    return ReadResult::error;
  }
  payload.resize(length);
  if (!read_exact_overlapped(handle, payload.data(), length, clean_eof, error)) return ReadResult::error;
  return ReadResult::message;
}

bool write_framed_message_overlapped(HANDLE handle, std::string_view payload, std::mutex* mutex, std::string& error) {
  if (payload.empty() || payload.size() > kMaximumMessageBytes || payload.size() > std::numeric_limits<std::uint32_t>::max()) {
    error = "payload length is outside the native messaging limit";
    return false;
  }
  const auto write = [&]() {
    const auto length = static_cast<std::uint32_t>(payload.size());
    return write_exact_overlapped(handle, &length, sizeof(length), error) && write_exact_overlapped(handle, payload.data(), length, error);
  };
  if (mutex == nullptr) return write();
  const std::scoped_lock lock(*mutex);
  return write();
}

ValidationResult validate_browser_request(const json::Value& value) {
  const auto* object = value.as_object();
  if (object == nullptr) return invalid("invalid_schema", "request must be a JSON object");
  const auto type = get_string(*object, "type");
  if (!type.has_value()) return invalid("invalid_schema", "type must be a string");

  if (*type == "hello" || *type == "capabilities") {
    auto keys = check_keys(*object, {"type", "protocolVersion", "requestId"});
    if (!keys.valid) return keys;
    return validate_common(*object, false);
  }
  if (*type == "start") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "sessionId", "windowNonce", "mode", "quality", "frameGenerationEnabled"},
        {"targetWidth", "targetHeight", "captureX", "captureY", "captureWidth", "captureHeight"});
    if (!keys.valid) return keys;
    auto common = validate_common(*object, true);
    if (!common.valid) return common;
    const auto nonce = get_string(*object, "windowNonce");
    if (!nonce.has_value() || !is_nonce(*nonce)) return invalid("invalid_schema", "windowNonce must contain exactly 32 lowercase hexadecimal characters");
    auto configuration = validate_configuration(*object);
    if (!configuration.valid) return configuration;
    const auto width = get_number(*object, "targetWidth").value_or(0.0);
    const auto height = get_number(*object, "targetHeight").value_or(0.0);
    if (!is_integer_in_range(width, 0, 16384) || !is_integer_in_range(height, 0, 16384) || ((width == 0) != (height == 0))) {
      return invalid("invalid_target", "targetWidth and targetHeight must both be zero/omitted or integers from 64 to 16384");
    }
    if (width != 0 && (width < 64 || height < 64)) return invalid("invalid_target", "non-zero target dimensions must be at least 64 pixels");
    const std::array<std::string_view, 4> crop_keys{"captureX", "captureY", "captureWidth", "captureHeight"};
    const auto crop_count = std::count_if(crop_keys.begin(), crop_keys.end(), [&](std::string_view key) {
      return json::find(*object, key) != nullptr;
    });
    const auto all_crop_keys = static_cast<decltype(crop_count)>(crop_keys.size());
    if (crop_count != 0 && crop_count != all_crop_keys) {
      return invalid("invalid_capture_region", "captureX, captureY, captureWidth, and captureHeight must be provided together");
    }
    if (crop_count == all_crop_keys) {
      const auto x = get_number(*object, "captureX").value_or(-1.0);
      const auto y = get_number(*object, "captureY").value_or(-1.0);
      const auto crop_width = get_number(*object, "captureWidth").value_or(0.0);
      const auto crop_height = get_number(*object, "captureHeight").value_or(0.0);
      if (!is_integer_in_range(x, 0, 16384) || !is_integer_in_range(y, 0, 16384) ||
          !is_integer_in_range(crop_width, 64, 16384) || !is_integer_in_range(crop_height, 64, 16384)) {
        return invalid("invalid_capture_region", "capture region values must be integer physical pixels within range");
      }
    }
    return {true, {}, {}};
  }
  if (*type == "updateConfiguration") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "sessionId", "mode", "quality", "frameGenerationEnabled"});
    if (!keys.valid) return keys;
    auto common = validate_common(*object, true);
    if (!common.valid) return common;
    return validate_configuration(*object);
  }
  if (*type == "stop") {
    auto keys = check_keys(*object, {"type", "protocolVersion", "requestId", "sessionId"});
    if (!keys.valid) return keys;
    return validate_common(*object, true);
  }
  if (*type == "status") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "sessionId"}, {"playbackActive", "mediaTime"});
    if (!keys.valid) return keys;
    auto common = validate_common(*object, true);
    if (!common.valid) return common;
    const auto* playback_active = json::find(*object, "playbackActive");
    const auto* media_time = json::find(*object, "mediaTime");
    if ((playback_active == nullptr) != (media_time == nullptr)) {
      return invalid("invalid_status", "playbackActive and mediaTime must be provided together");
    }
    if (playback_active != nullptr && (!playback_active->as_bool().has_value()
        || !media_time->as_number().has_value() || *media_time->as_number() < 0.0
        || *media_time->as_number() > 86400000.0)) {
      return invalid("invalid_status", "playback state must contain a boolean and a non-negative media time");
    }
    return {true, {}, {}};
  }
  if (*type == "mediaCommand") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "sessionId", "command"}, {"value"});
    if (!keys.valid) return keys;
    auto common = validate_common(*object, true);
    if (!common.valid) return common;
    const auto command = get_string(*object, "command");
    static constexpr std::array<std::string_view, 8> commands{
        "playPause", "play", "pause", "seekBy", "volumeBy", "toggleMute", "toggleFullscreen", "exitFullscreen"};
    if (!command.has_value() || std::find(commands.begin(), commands.end(), *command) == commands.end()) {
      return invalid("invalid_command", "unsupported media command");
    }
    const auto* raw_value = json::find(*object, "value");
    if (raw_value != nullptr && !raw_value->as_number().has_value()) return invalid("invalid_schema", "value must be numeric");
    return {true, {}, {}};
  }
  if (*type == "pointer") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "sessionId", "event", "x", "y"},
        {"button", "buttons", "deltaX", "deltaY", "shiftKey", "ctrlKey", "altKey"});
    if (!keys.valid) return keys;
    auto common = validate_common(*object, true);
    if (!common.valid) return common;
    const auto event = get_string(*object, "event");
    if (!event.has_value() || (*event != "move" && *event != "down" && *event != "up" && *event != "wheel")) {
      return invalid("invalid_pointer", "event must be move, down, up, or wheel");
    }
    const auto x = get_number(*object, "x");
    const auto y = get_number(*object, "y");
    if (!x.has_value() || !y.has_value() || *x < 0 || *x > 1 || *y < 0 || *y > 1) {
      return invalid("invalid_pointer", "x and y must be normalized numbers from 0 to 1");
    }
    for (const auto key : {"button", "buttons", "deltaX", "deltaY"}) {
      const auto* item = json::find(*object, key);
      if (item != nullptr && !item->as_number().has_value()) return invalid("invalid_pointer", std::string(key) + " must be numeric");
    }
    for (const auto key : {"shiftKey", "ctrlKey", "altKey"}) {
      const auto* item = json::find(*object, key);
      if (item != nullptr && !item->as_bool().has_value()) {
        return invalid("invalid_pointer", std::string(key) + " must be boolean");
      }
    }
    return {true, {}, {}};
  }
  return invalid("unknown_command", "unsupported native command: " + *type);
}

ValidationResult validate_renderer_event(const json::Value& value) {
  const auto* object = value.as_object();
  if (object == nullptr) return invalid("invalid_renderer_event", "renderer event must be an object");
  const auto type = get_string(*object, "type");
  const auto version = get_number(*object, "protocolVersion");
  if (!type.has_value() || !version.has_value() || *version != static_cast<double>(kProtocolVersion)) {
    return invalid("invalid_renderer_event", "renderer event has invalid type or protocolVersion");
  }
  if (*type == "ready") {
    auto keys = check_keys(*object, {"type", "protocolVersion", "requestId"});
    if (!keys.valid) return keys;
    const auto request = get_string(*object, "requestId");
    return request.has_value() && is_identifier(*request) ? ValidationResult{true, {}, {}} : invalid("invalid_renderer_event", "invalid requestId");
  }
  if (*type == "capabilities") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "windowsCapture", "d3d11", "modes", "qualities", "frameGeneration"});
    if (!keys.valid) return keys;
    if (!has_valid_identifier(*object, "requestId") ||
        !get_bool(*object, "windowsCapture").has_value() || !get_bool(*object, "d3d11").has_value() ||
        !get_bool(*object, "frameGeneration").has_value() ||
        !array_matches(json::find(*object, "modes"), is_mode) ||
        !array_matches(json::find(*object, "qualities"), is_quality)) {
      return invalid("invalid_renderer_event", "invalid capabilities payload");
    }
    return {true, {}, {}};
  }
  if (*type == "status") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "sessionId", "state", "message"}, {"requestId"});
    if (!keys.valid) return keys;
    const auto state = get_string(*object, "state");
    if (!has_valid_identifier(*object, "sessionId") || !has_valid_optional_identifier(*object, "requestId") ||
        !state.has_value() || !is_session_state(*state) || !get_string(*object, "message").has_value()) {
      return invalid("invalid_renderer_event", "invalid status payload");
    }
    return {true, {}, {}};
  }
  if (*type == "metrics") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "sessionId", "fps", "frameTimeMs", "droppedFrames"});
    if (!keys.valid) return keys;
    const auto fps = get_number(*object, "fps");
    const auto frame_time = get_number(*object, "frameTimeMs");
    const auto dropped_frames = get_number(*object, "droppedFrames");
    if (!has_valid_identifier(*object, "sessionId") ||
        !fps.has_value() || *fps < 0.0 || !frame_time.has_value() || *frame_time < 0.0 ||
        !dropped_frames.has_value() || *dropped_frames < 0.0) {
      return invalid("invalid_renderer_event", "invalid metrics payload");
    }
    return {true, {}, {}};
  }
  if (*type == "error") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "code", "message", "recoverable"}, {"requestId", "sessionId"});
    if (!keys.valid) return keys;
    if (!has_valid_optional_identifier(*object, "requestId") || !has_valid_optional_identifier(*object, "sessionId") ||
        !get_string(*object, "code").has_value() || !get_string(*object, "message").has_value() ||
        !get_bool(*object, "recoverable").has_value()) {
      return invalid("invalid_renderer_event", "invalid error payload");
    }
    return {true, {}, {}};
  }
  if (*type == "stopped") {
    auto keys = check_keys(*object,
        {"type", "protocolVersion", "requestId", "sessionId", "reason"});
    if (!keys.valid) return keys;
    return has_valid_identifier(*object, "requestId") && has_valid_identifier(*object, "sessionId") &&
        get_string(*object, "reason").has_value()
        ? ValidationResult{true, {}, {}}
        : invalid("invalid_renderer_event", "invalid stopped payload");
  }
  if (*type == "pointer" || *type == "mediaCommand") {
    const auto validation = validate_browser_request(value);
    return validation.valid ? ValidationResult{true, {}, {}} : invalid("invalid_renderer_event", validation.message);
  }
  return invalid("invalid_renderer_event", "unsupported renderer event: " + *type);
}

std::optional<std::string> get_string(const json::Object& object, std::string_view key) {
  const auto* value = json::find(object, key);
  if (value == nullptr || value->as_string() == nullptr) return std::nullopt;
  return *value->as_string();
}

std::optional<double> get_number(const json::Object& object, std::string_view key) {
  const auto* value = json::find(object, key);
  return value == nullptr ? std::nullopt : value->as_number();
}

std::optional<bool> get_bool(const json::Object& object, std::string_view key) {
  const auto* value = json::find(object, key);
  return value == nullptr ? std::nullopt : value->as_bool();
}

json::Value make_error(
    std::string code,
    std::string message,
    std::optional<std::string> request_id,
    std::optional<std::string> session_id,
    bool recoverable) {
  json::Object object{
      {"type", "error"},
      {"protocolVersion", static_cast<int>(kProtocolVersion)},
      {"code", std::move(code)},
      {"message", std::move(message)},
      {"recoverable", recoverable},
  };
  if (request_id.has_value()) object.emplace("requestId", std::move(*request_id));
  if (session_id.has_value()) object.emplace("sessionId", std::move(*session_id));
  return object;
}

}  // namespace anime4k::protocol
