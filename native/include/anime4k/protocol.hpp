#pragma once

#include "anime4k/json.hpp"

#include <Windows.h>

#include <cstdint>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>

namespace anime4k::protocol {

inline constexpr std::uint32_t kProtocolVersion = 3;
inline constexpr std::uint32_t kMaximumMessageBytes = 1024U * 1024U;
inline constexpr wchar_t kHostName[] = L"io.github.anime4k_browser.native";

enum class ReadResult { message, end_of_stream, error };

struct ValidationResult {
  bool valid{};
  std::string code;
  std::string message;
};

[[nodiscard]] ReadResult read_framed_message(HANDLE handle, std::string& payload, std::string& error);
[[nodiscard]] bool write_framed_message(HANDLE handle, std::string_view payload, std::mutex* mutex, std::string& error);
[[nodiscard]] ReadResult read_framed_message_overlapped(HANDLE handle, std::string& payload, std::string& error);
[[nodiscard]] bool write_framed_message_overlapped(HANDLE handle, std::string_view payload, std::mutex* mutex, std::string& error);

[[nodiscard]] ValidationResult validate_browser_request(const json::Value& value);
[[nodiscard]] ValidationResult validate_renderer_event(const json::Value& value);

[[nodiscard]] std::optional<std::string> get_string(const json::Object& object, std::string_view key);
[[nodiscard]] std::optional<double> get_number(const json::Object& object, std::string_view key);
[[nodiscard]] std::optional<bool> get_bool(const json::Object& object, std::string_view key);

[[nodiscard]] json::Value make_error(
    std::string code,
    std::string message,
    std::optional<std::string> request_id = std::nullopt,
    std::optional<std::string> session_id = std::nullopt,
    bool recoverable = false);

}  // namespace anime4k::protocol
