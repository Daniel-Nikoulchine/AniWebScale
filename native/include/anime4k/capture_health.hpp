#pragma once

#include <cstdint>

namespace anime4k::capture {

inline constexpr char kProtectedCaptureMessage[] =
    "The browser delivered only black frames while playback advanced. Protected or DRM video cannot be captured by "
    "the native renderer; use a non-protected video";

enum class HealthState {
  healthy,
  continuously_black,
  continuously_frozen,
};

[[nodiscard]] bool is_effectively_black(std::uint32_t black_pixels, std::uint32_t total_pixels) noexcept;

class HealthDetector {
 public:
  [[nodiscard]] HealthState observe(
      bool black,
      std::uint64_t fingerprint,
      std::uint64_t timestamp_ms,
      bool playback_active = false,
      double media_time_seconds = 0.0) noexcept;
  void reset() noexcept;

 private:
  static constexpr std::uint64_t kBlackThresholdMs = 15000;
  static constexpr double kBlackMinimumMediaAdvanceSeconds = 8.0;
  static constexpr std::uint64_t kFrozenThresholdMs = 30000;
  static constexpr double kFrozenMinimumMediaAdvanceSeconds = 15.0;
  static constexpr std::uint32_t kMinimumObservations = 3;

  bool initialized_{};
  bool previous_black_{};
  std::uint64_t previous_fingerprint_{};
  std::uint64_t black_since_ms_{};
  std::uint64_t frozen_since_ms_{};
  std::uint32_t black_observations_{};
  std::uint32_t frozen_observations_{};
  bool previous_playback_active_{};
  double black_media_since_seconds_{};
  double frozen_media_since_seconds_{};
};

}  // namespace anime4k::capture
