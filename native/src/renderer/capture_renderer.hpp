#pragma once

#include "anime4k/json.hpp"
#include "anime4k/capture_health.hpp"
#include "anime4k/capture_resize.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <wrl/client.h>

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>

#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

namespace anime4k::renderer {

class Anime4KPipeline;
class AnimeJanaiPipeline;
class FrameGenerationPipeline;

struct StartOptions {
  std::string session_id;
  std::string window_nonce;
  std::string mode;
  std::string quality;
  std::uint32_t target_width{};
  std::uint32_t target_height{};
  std::uint32_t capture_x{};
  std::uint32_t capture_y{};
  std::uint32_t capture_width{};
  std::uint32_t capture_height{};
  bool frame_generation_enabled{};
};

class CaptureRenderer {
 public:
  using EventSink = std::function<void(json::Value)>;

  explicit CaptureRenderer(EventSink event_sink);
  ~CaptureRenderer();
  CaptureRenderer(const CaptureRenderer&) = delete;
  CaptureRenderer& operator=(const CaptureRenderer&) = delete;

  [[nodiscard]] bool start(const StartOptions& options, std::string& error);
  void update_configuration(std::string mode, std::string quality, bool frame_generation_enabled);
  void update_playback_state(bool active, double media_time_seconds);
  void stop(std::string_view reason);
  [[nodiscard]] bool active() const noexcept { return active_.load(std::memory_order_relaxed); }
  [[nodiscard]] const std::string& session_id() const noexcept { return options_.session_id; }
  [[nodiscard]] std::string state_message() const;

  static constexpr UINT kFrameReadyMessage = WM_APP + 10;
  static constexpr UINT kCaptureClosedMessage = WM_APP + 11;
  static constexpr UINT kCaptureResizeMessage = WM_APP + 12;
  static constexpr UINT kCaptureResizeDispatchFailedMessage = WM_APP + 13;
  static constexpr UINT kNeuralFrameCompleteMessage = WM_APP + 14;
  static constexpr UINT_PTR kExitFullscreenTimer = 1;
  static constexpr UINT_PTR kGeneratedFrameTimer = 2;
  static constexpr int kEscapeHotkeyId = 0xA4E1;
  void render_latest_frame(std::uint64_t capture_generation);
  void render_generated_frame();
  void finish_neural_frame(std::uint64_t neural_job_generation);
  void handle_capture_closed(std::uint64_t capture_generation);
  void handle_capture_resize_dispatch_failure(std::uint64_t capture_generation);

 private:
  struct NeuralFrameCompletion;

  [[nodiscard]] bool initialize_d3d(std::string& error);
  [[nodiscard]] bool initialize_output_window(HWND source_window, std::string& error);
  [[nodiscard]] bool initialize_capture(HWND source_window, std::string& error);
  [[nodiscard]] bool create_swap_chain(std::uint32_t width, std::uint32_t height, std::string& error);
  [[nodiscard]] bool ensure_capture_copy(const D3D11_TEXTURE2D_DESC& description, std::string& error);
  void apply_pending_capture_resize(std::uint64_t capture_generation);
  void fail_active_session(
      std::string code,
      std::string message,
      std::string reason,
      std::string request_id,
      bool release_device);
  void release_capture();
  void release_output();
  void release_d3d();
  void emit_metrics(double frame_time_ms);
  void emit_pointer(UINT message, WPARAM wparam, LPARAM lparam);
  void emit_fullscreen_exit(HWND window);
  [[nodiscard]] capture::HealthState probe_capture_health(const D3D11_TEXTURE2D_DESC& description, std::string& warning);
  [[nodiscard]] HWND find_source_window(std::string& error) const;
  [[nodiscard]] bool process_and_present(
      ID3D11Texture2D* source_texture,
      ID3D11ShaderResourceView* source_view,
      std::uint32_t source_width,
      std::uint32_t source_height,
      double capture_time_ms,
      std::string& error);
  void update_content_rectangle(std::uint32_t source_width, std::uint32_t source_height) noexcept;
  [[nodiscard]] bool present_processed_frame(
      ID3D11Texture2D* processed_texture,
      ID3D11ShaderResourceView* processed_view,
      double capture_time_ms,
      std::string& error);
  [[nodiscard]] bool present_frame(
      ID3D11ShaderResourceView* source_view,
      bool interpolated,
      float interpolation_factor,
      std::string& error);
  void schedule_generated_frame();
  void reset_frame_generation() noexcept;

  void on_frame_arrived(
      const winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool& sender,
      const winrt::Windows::Foundation::IInspectable&,
      std::uint64_t capture_generation);
  void on_capture_closed(std::uint64_t capture_generation);

  static LRESULT CALLBACK window_proc(HWND window, UINT message, WPARAM wparam, LPARAM lparam);

  EventSink event_sink_;
  StartOptions options_;
  std::atomic_bool active_{false};
  std::atomic_bool frame_pending_{false};
  std::atomic<std::uint64_t> dropped_frames_{0};
  std::atomic<std::uint64_t> capture_generation_{0};
  DWORD renderer_thread_id_{};
  HWND source_window_{};
  HWND output_window_{};
  RECT content_rectangle_{};
  std::uint32_t output_width_{};
  std::uint32_t output_height_{};

  Microsoft::WRL::ComPtr<ID3D11Device> device_;
  Microsoft::WRL::ComPtr<ID3D11DeviceContext> context_;
  Microsoft::WRL::ComPtr<IDXGISwapChain1> swap_chain_;
  Microsoft::WRL::ComPtr<ID3D11RenderTargetView> back_buffer_view_;
  Microsoft::WRL::ComPtr<ID3D11VertexShader> vertex_shader_;
  Microsoft::WRL::ComPtr<ID3D11PixelShader> present_shader_;
  Microsoft::WRL::ComPtr<ID3D11SamplerState> sampler_;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> latest_texture_;
  Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> latest_view_;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> capture_probe_texture_;
  std::unique_ptr<Anime4KPipeline> anime4k_pipeline_;
  std::unique_ptr<AnimeJanaiPipeline> animejanai_pipeline_;
  std::unique_ptr<FrameGenerationPipeline> frame_generation_pipeline_;
  std::mutex frame_callback_mutex_;
  std::mutex d3d_mutex_;
  std::jthread neural_worker_;
  std::atomic_bool neural_processing_{false};
  std::atomic_bool neural_frame_waiting_{false};
  std::unique_ptr<NeuralFrameCompletion> neural_completion_;
  std::uint64_t neural_job_generation_{};
  std::uint64_t configuration_generation_{};

  winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice winrt_device_{nullptr};
  winrt::Windows::Graphics::Capture::GraphicsCaptureItem capture_item_{nullptr};
  winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool frame_pool_{nullptr};
  winrt::Windows::Graphics::Capture::GraphicsCaptureSession capture_session_{nullptr};
  winrt::event_token frame_arrived_token_{};
  winrt::event_token capture_closed_token_{};
  capture::FramePoolResizeState capture_resize_state_;

  std::chrono::steady_clock::time_point metrics_start_{};
  std::uint64_t metrics_frames_{};
  std::uint64_t metrics_render_samples_{};
  double metrics_frame_time_ms_{};
  std::uint64_t pointer_sequence_{};
  std::uint64_t rendered_frame_sequence_{};
  double latest_capture_time_ms_{};
  double last_rendered_capture_time_ms_{};
  double frame_interval_ms_{1000.0 / 24.0};
  HRESULT last_render_hresult_{S_OK};
  capture::HealthDetector health_detector_;
  bool playback_active_{};
  bool output_presented_{};
  bool capture_geometry_logged_{};
  bool escape_hotkey_registered_{};
  double media_time_seconds_{};
  std::chrono::steady_clock::time_point playback_state_received_{};
};

}  // namespace anime4k::renderer
