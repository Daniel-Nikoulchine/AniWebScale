#pragma once

#include <Windows.h>

#include <optional>
#include <string>
#include <string_view>

namespace anime4k::win32 {

[[nodiscard]] std::string last_error_message(DWORD error = GetLastError());
[[nodiscard]] std::wstring executable_directory();
[[nodiscard]] std::wstring utf8_to_wide(std::string_view value);
[[nodiscard]] std::string wide_to_utf8(std::wstring_view value);
[[nodiscard]] std::wstring current_user_sid();
[[nodiscard]] std::optional<std::string> read_text_file(const std::wstring& path);
[[nodiscard]] bool is_process_running(DWORD process_id) noexcept;
void debug_log(std::string_view component, std::string_view message) noexcept;

}  // namespace anime4k::win32
