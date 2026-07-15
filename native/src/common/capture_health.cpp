#include "anime4k/capture_health.hpp"

#include <cmath>

namespace anime4k::capture {

bool is_effectively_black(std::uint32_t black_pixels, std::uint32_t total_pixels) noexcept {
  if (total_pixels == 0 || black_pixels > total_pixels) return false;
  // Allow sparse browser chrome, subtitles, compression noise, or a cursor in
  // the probe while still detecting a protected all-black video surface.
  return static_cast<std::uint64_t>(black_pixels) * 100ULL >= static_cast<std::uint64_t>(total_pixels) * 95ULL;
}

HealthState HealthDetector::observe(
    bool black,
    std::uint64_t fingerprint,
    std::uint64_t timestamp_ms,
    bool playback_active,
    double media_time_seconds) noexcept {
  const bool valid_playback_position = playback_active && std::isfinite(media_time_seconds) && media_time_seconds >= 0.0;
  if (!initialized_) {
    initialized_ = true;
    previous_black_ = black && valid_playback_position;
    previous_fingerprint_ = fingerprint;
    black_since_ms_ = timestamp_ms;
    frozen_since_ms_ = timestamp_ms;
    black_observations_ = previous_black_ ? 1U : 0U;
    frozen_observations_ = valid_playback_position ? 1U : 0U;
    previous_playback_active_ = valid_playback_position;
    black_media_since_seconds_ = previous_black_ ? media_time_seconds : 0.0;
    frozen_media_since_seconds_ = valid_playback_position ? media_time_seconds : 0.0;
    return HealthState::healthy;
  }

  const bool playback_started = valid_playback_position && !previous_playback_active_;
  const bool black_playback_went_backwards = valid_playback_position
      && media_time_seconds + 0.25 < black_media_since_seconds_;
  const bool active_black = black && valid_playback_position;
  if (active_black) {
    if (!previous_black_ || playback_started || black_playback_went_backwards) {
      black_since_ms_ = timestamp_ms;
      black_observations_ = 1;
      black_media_since_seconds_ = media_time_seconds;
    } else {
      ++black_observations_;
    }
  } else {
    black_since_ms_ = timestamp_ms;
    black_observations_ = 0;
  }
  previous_black_ = active_black;

  const bool playback_went_backwards = valid_playback_position
      && media_time_seconds + 0.25 < frozen_media_since_seconds_;
  if (!valid_playback_position || playback_started || playback_went_backwards) {
    previous_fingerprint_ = fingerprint;
    frozen_since_ms_ = timestamp_ms;
    frozen_observations_ = valid_playback_position ? 1U : 0U;
    frozen_media_since_seconds_ = valid_playback_position ? media_time_seconds : 0.0;
  } else if (fingerprint == previous_fingerprint_) {
    ++frozen_observations_;
  } else {
    previous_fingerprint_ = fingerprint;
    frozen_since_ms_ = timestamp_ms;
    frozen_observations_ = 1;
    frozen_media_since_seconds_ = media_time_seconds;
  }
  previous_playback_active_ = valid_playback_position;

  if (black_observations_ >= kMinimumObservations && timestamp_ms >= black_since_ms_ &&
      timestamp_ms - black_since_ms_ >= kBlackThresholdMs &&
      media_time_seconds >= black_media_since_seconds_ + kBlackMinimumMediaAdvanceSeconds) {
    return HealthState::continuously_black;
  }
  if (frozen_observations_ >= kMinimumObservations && timestamp_ms >= frozen_since_ms_ &&
      timestamp_ms - frozen_since_ms_ >= kFrozenThresholdMs &&
      media_time_seconds >= frozen_media_since_seconds_ + kFrozenMinimumMediaAdvanceSeconds) {
    return HealthState::continuously_frozen;
  }
  return HealthState::healthy;
}

void HealthDetector::reset() noexcept {
  initialized_ = false;
  previous_black_ = false;
  previous_fingerprint_ = 0;
  black_since_ms_ = 0;
  frozen_since_ms_ = 0;
  black_observations_ = 0;
  frozen_observations_ = 0;
  previous_playback_active_ = false;
  black_media_since_seconds_ = 0.0;
  frozen_media_since_seconds_ = 0.0;
}

}  // namespace anime4k::capture
