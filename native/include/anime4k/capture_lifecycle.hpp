#pragma once

#include <cstdint>

namespace anime4k::capture {

[[nodiscard]] constexpr bool is_current_generation(
    std::uint64_t dispatched_generation,
    std::uint64_t current_generation) noexcept {
  return dispatched_generation != 0 && dispatched_generation == current_generation;
}

[[nodiscard]] constexpr bool should_handle_close(
    bool active,
    std::uint64_t dispatched_generation,
    std::uint64_t current_generation) noexcept {
  return active && is_current_generation(dispatched_generation, current_generation);
}

// The caller must hold the lifecycle lock that protects the output target until
// PostMessage returns. This helper validates the snapshot acquired by that lease.
[[nodiscard]] constexpr bool should_dispatch_capture_window_message(
    bool active,
    std::uint64_t callback_generation,
    std::uint64_t current_generation,
    bool output_window_available) noexcept {
  return active && output_window_available
      && is_current_generation(callback_generation, current_generation);
}

[[nodiscard]] constexpr bool should_handle_capture_window_message(
    bool active,
    std::uint64_t message_generation,
    std::uint64_t current_generation) noexcept {
  return active && is_current_generation(message_generation, current_generation);
}

struct NeuralGenerationSnapshot {
  std::uint64_t capture{};
  std::uint64_t configuration{};
  std::uint64_t resize{};
};

[[nodiscard]] constexpr bool should_process_neural_frame(
    bool stop_requested,
    bool active,
    bool neural_mode,
    bool resize_pending,
    const NeuralGenerationSnapshot& job,
    const NeuralGenerationSnapshot& current) noexcept {
  return !stop_requested && active && neural_mode && !resize_pending
      && is_current_generation(job.capture, current.capture)
      && is_current_generation(job.configuration, current.configuration)
      && is_current_generation(job.resize, current.resize);
}

[[nodiscard]] constexpr bool should_present_neural_completion(
    bool active,
    bool neural_mode,
    bool resize_pending,
    const NeuralGenerationSnapshot& completion,
    const NeuralGenerationSnapshot& current) noexcept {
  return should_process_neural_frame(
      false, active, neural_mode, resize_pending, completion, current);
}

}  // namespace anime4k::capture
