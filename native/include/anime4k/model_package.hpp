#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <string_view>

namespace anime4k::models {

struct Binding {
  const char* logical_resource;
  std::uint32_t srv_slot;
};

struct Pass {
  const char* id;
  const Binding* bindings;
  std::uint32_t binding_count;
  const char* output_resource;
  const char* const* width_rpn;
  std::uint32_t width_rpn_count;
  const char* const* height_rpn;
  std::uint32_t height_rpn_count;
  const char* const* when_rpn;
  std::uint32_t when_rpn_count;
  bool replaces_bound_resource;
  const std::uint8_t* bytecode;
  std::size_t bytecode_size;
};

struct Effect {
  const char* id;
  const char* family;
  const Pass* passes;
  std::uint32_t pass_count;
};

struct Preset {
  const char* id;
  const char* mode;
  const char* quality;
  const char* const* effect_ids;
  std::uint32_t effect_count;
};

[[nodiscard]] std::span<const Effect> effects() noexcept;
[[nodiscard]] std::span<const Preset> presets() noexcept;
[[nodiscard]] const Effect* find_effect(std::string_view id) noexcept;
[[nodiscard]] const Preset* find_preset(std::string_view mode, std::string_view quality) noexcept;

}  // namespace anime4k::models

