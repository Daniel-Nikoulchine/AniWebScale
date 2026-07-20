#include "anime4k/win32_util.hpp"

#include <sddl.h>

#include <filesystem>
#include <fstream>
#include <sstream>
#include <vector>

namespace anime4k::win32 {

std::string last_error_message(DWORD error) {
  wchar_t* buffer = nullptr;
  const DWORD length = FormatMessageW(
      FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
      nullptr,
      error,
      MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
      reinterpret_cast<wchar_t*>(&buffer),
      0,
      nullptr);
  std::wstring message = length > 0 && buffer != nullptr ? std::wstring(buffer, length) : L"Windows error " + std::to_wstring(error);
  if (buffer != nullptr) LocalFree(buffer);
  while (!message.empty() && (message.back() == L'\r' || message.back() == L'\n' || message.back() == L' ')) message.pop_back();
  return wide_to_utf8(message);
}

std::wstring executable_directory() {
  std::vector<wchar_t> buffer(32768);
  const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  if (length == 0 || length >= buffer.size()) return {};
  return std::filesystem::path(std::wstring(buffer.data(), length)).parent_path().wstring();
}

std::wstring utf8_to_wide(std::string_view value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) return {};
  std::wstring output(static_cast<std::size_t>(size), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), size) != size) return {};
  return output;
}

std::string wide_to_utf8(std::wstring_view value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) return {};
  std::string output(static_cast<std::size_t>(size), '\0');
  if (WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), output.data(), size, nullptr, nullptr) != size) return {};
  return output;
}

std::wstring current_user_sid() {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) return {};
  DWORD required = 0;
  GetTokenInformation(token, TokenUser, nullptr, 0, &required);
  std::vector<std::byte> buffer(required);
  if (!GetTokenInformation(token, TokenUser, buffer.data(), required, &required)) {
    CloseHandle(token);
    return {};
  }
  CloseHandle(token);
  const auto* user = reinterpret_cast<const TOKEN_USER*>(buffer.data());
  wchar_t* sid = nullptr;
  if (!ConvertSidToStringSidW(user->User.Sid, &sid)) return {};
  std::wstring result(sid);
  LocalFree(sid);
  return result;
}

std::optional<std::string> read_text_file(const std::wstring& path) {
  std::ifstream stream(std::filesystem::path(path), std::ios::binary);
  if (!stream) return std::nullopt;
  std::ostringstream contents;
  contents << stream.rdbuf();
  return contents.str();
}

bool is_process_running(DWORD process_id) noexcept {
  if (process_id == 0) return false;
  HANDLE process = OpenProcess(SYNCHRONIZE, FALSE, process_id);
  if (process == nullptr) return false;
  const DWORD result = WaitForSingleObject(process, 0);
  CloseHandle(process);
  return result == WAIT_TIMEOUT;
}

void debug_log(std::string_view component, std::string_view message) noexcept {
  try {
    wchar_t path[32768]{};
    const DWORD length = GetEnvironmentVariableW(L"ANIME4K_NATIVE_DEBUG_LOG", path, static_cast<DWORD>(std::size(path)));
    if (length == 0 || length >= std::size(path)) return;
    std::ofstream stream(std::filesystem::path(std::wstring(path, length)), std::ios::binary | std::ios::app);
    if (!stream) return;
    stream << GetCurrentProcessId() << ' ' << component << ": " << message << "\r\n";
  } catch (...) {
  }
}

}  // namespace anime4k::win32
