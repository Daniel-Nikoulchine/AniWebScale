#include "anime4k/geometry.hpp"

#include <algorithm>
#include <cmath>

namespace anime4k::geometry {

PixelRectangle contain_rectangle(
    int source_width,
    int source_height,
    int output_width,
    int output_height) noexcept {
  if (source_width <= 0 || source_height <= 0 || output_width <= 0 || output_height <= 0) return {};
  const double scale = std::min(
      static_cast<double>(output_width) / static_cast<double>(source_width),
      static_cast<double>(output_height) / static_cast<double>(source_height));
  const int contained_width = std::min(output_width, static_cast<int>(std::lround(source_width * scale)));
  const int contained_height = std::min(output_height, static_cast<int>(std::lround(source_height * scale)));
  const int left = (output_width - contained_width) / 2;
  const int top = (output_height - contained_height) / 2;
  return PixelRectangle{left, top, left + contained_width, top + contained_height};
}

std::optional<NormalizedPoint> normalize_pointer(
    const PixelRectangle& content,
    int pointer_x,
    int pointer_y) noexcept {
  const int width = content.right - content.left;
  const int height = content.bottom - content.top;
  if (width <= 0 || height <= 0) return std::nullopt;
  if (pointer_x < content.left || pointer_x >= content.right
      || pointer_y < content.top || pointer_y >= content.bottom) return std::nullopt;
  return NormalizedPoint{
      static_cast<double>(pointer_x - content.left) / static_cast<double>(width),
      static_cast<double>(pointer_y - content.top) / static_cast<double>(height),
  };
}

std::optional<PixelRectangle> clip_capture_region(
    int client_width,
    int client_height,
    int requested_x,
    int requested_y,
    int requested_width,
    int requested_height) noexcept {
  if (client_width <= 0 || client_height <= 0 || requested_width < 64 || requested_height < 64) {
    return std::nullopt;
  }
  const int left = std::clamp(requested_x, 0, client_width);
  const int top = std::clamp(requested_y, 0, client_height);
  const int right = std::clamp(left + requested_width, left, client_width);
  const int bottom = std::clamp(top + requested_height, top, client_height);
  if (right - left < 64 || bottom - top < 64) return std::nullopt;
  return PixelRectangle{left, top, right, bottom};
}

int dom_buttons_from_win32(std::uintptr_t key_state) noexcept {
  constexpr std::uintptr_t kLeft = 0x0001;
  constexpr std::uintptr_t kRight = 0x0002;
  constexpr std::uintptr_t kMiddle = 0x0010;
  constexpr std::uintptr_t kX1 = 0x0020;
  constexpr std::uintptr_t kX2 = 0x0040;
  int buttons = 0;
  if ((key_state & kLeft) != 0) buttons |= 1;
  if ((key_state & kRight) != 0) buttons |= 2;
  if ((key_state & kMiddle) != 0) buttons |= 4;
  if ((key_state & kX1) != 0) buttons |= 8;
  if ((key_state & kX2) != 0) buttons |= 16;
  return buttons;
}

int dom_wheel_delta_from_win32(int wheel_delta) noexcept {
  return -wheel_delta;
}

}  // namespace anime4k::geometry
