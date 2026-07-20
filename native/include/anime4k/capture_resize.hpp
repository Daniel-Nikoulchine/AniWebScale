#pragma once

#include <atomic>
#include <cstdint>
#include <optional>

namespace anime4k::capture {

struct CaptureExtent {
  std::uint32_t width{};
  std::uint32_t height{};

  [[nodiscard]] explicit constexpr operator bool() const noexcept {
    return width != 0 && height != 0;
  }
  friend bool operator==(const CaptureExtent&, const CaptureExtent&) = default;
};

// Coordinates resize requests between the free-threaded WGC callback and the
// renderer's window thread. A pending request is intentionally single-flight:
// frames are discarded until the window thread has recreated the frame pool.
class FramePoolResizeState {
 public:
  void reset(std::uint32_t width = 0, std::uint32_t height = 0) noexcept {
    pending_.store(0, std::memory_order_release);
    current_.store(pack({width, height}), std::memory_order_release);
    generation_.fetch_add(1, std::memory_order_acq_rel);
  }

  [[nodiscard]] bool request(std::int32_t width, std::int32_t height) noexcept {
    if (width <= 0 || height <= 0) return false;
    const auto desired = pack({static_cast<std::uint32_t>(width), static_cast<std::uint32_t>(height)});
    if (desired == current_.load(std::memory_order_acquire)) return false;
    std::uint64_t empty = 0;
    if (!pending_.compare_exchange_strong(
            empty, desired, std::memory_order_acq_rel, std::memory_order_acquire)) return false;
    // A resize request starts a new content epoch immediately. Work from the
    // old extent is stale even before the window thread applies Recreate().
    generation_.fetch_add(1, std::memory_order_acq_rel);
    return true;
  }

  [[nodiscard]] bool has_pending() const noexcept {
    return pending_.load(std::memory_order_acquire) != 0;
  }

  [[nodiscard]] std::optional<CaptureExtent> pending_extent() const noexcept {
    const auto packed = pending_.load(std::memory_order_acquire);
    if (packed == 0) return std::nullopt;
    return unpack(packed);
  }

  [[nodiscard]] CaptureExtent current_extent() const noexcept {
    return unpack(current_.load(std::memory_order_acquire));
  }

  [[nodiscard]] std::uint64_t generation() const noexcept {
    return generation_.load(std::memory_order_acquire);
  }

  // Returns false only if the caller tried to apply an extent other than the
  // current single-flight request. In that case the pending request is kept.
  [[nodiscard]] bool mark_applied(CaptureExtent extent) noexcept {
    const auto applied = pack(extent);
    if (applied == 0 || pending_.load(std::memory_order_acquire) != applied) return false;
    current_.store(applied, std::memory_order_release);
    std::uint64_t expected = applied;
    return pending_.compare_exchange_strong(
        expected, 0, std::memory_order_acq_rel, std::memory_order_acquire);
  }

 private:
  [[nodiscard]] static constexpr std::uint64_t pack(CaptureExtent extent) noexcept {
    if (!extent) return 0;
    return (static_cast<std::uint64_t>(extent.width) << 32U) | extent.height;
  }

  [[nodiscard]] static constexpr CaptureExtent unpack(std::uint64_t packed) noexcept {
    return {
        static_cast<std::uint32_t>(packed >> 32U),
        static_cast<std::uint32_t>(packed & 0xffffffffULL),
    };
  }

  std::atomic<std::uint64_t> current_{0};
  std::atomic<std::uint64_t> pending_{0};
  std::atomic<std::uint64_t> generation_{0};
};

}  // namespace anime4k::capture
