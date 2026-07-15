#pragma once

#include <cstdint>
#include <optional>

namespace anime4k::geometry {

struct PixelRectangle {
  int left{};
  int top{};
  int right{};
  int bottom{};
};

struct NormalizedPoint {
  double x{};
  double y{};
};

/** Scales source proportionally until it fits completely inside the output.
 * The returned rectangle is centered and leaves letterbox space when the
 * source and output aspect ratios differ. */
[[nodiscard]] PixelRectangle contain_rectangle(
    int source_width,
    int source_height,
    int output_width,
    int output_height) noexcept;

[[nodiscard]] std::optional<NormalizedPoint> normalize_pointer(
    const PixelRectangle& content,
    int pointer_x,
    int pointer_y) noexcept;

/** Clips a requested player crop to the captured browser client area. */
[[nodiscard]] std::optional<PixelRectangle> clip_capture_region(
    int client_width,
    int client_height,
    int requested_x,
    int requested_y,
    int requested_width,
    int requested_height) noexcept;

// Converts Win32 MK_* state bits to the PointerEvent.buttons bit field.
[[nodiscard]] int dom_buttons_from_win32(std::uintptr_t key_state) noexcept;

// Win32 wheel deltas and WheelEvent.deltaY use opposite sign conventions.
[[nodiscard]] int dom_wheel_delta_from_win32(int wheel_delta) noexcept;

}  // namespace anime4k::geometry
