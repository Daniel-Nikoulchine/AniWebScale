#include "capture_renderer.hpp"

#include "anime4k_pipeline.hpp"
#include "animejanai_pipeline.hpp"
#include "frame_generation_pipeline.hpp"

#include "anime4k/capture_lifecycle.hpp"
#include "anime4k/d3d_device_status.hpp"
#include "anime4k/geometry.hpp"
#include "anime4k/protocol.hpp"
#include "anime4k/win32_util.hpp"

#include <Windows.Graphics.Capture.Interop.h>
#include <Windows.Graphics.DirectX.Direct3D11.Interop.h>
#include <dwmapi.h>
#include <windowsx.h>

#include <shaders/FullscreenVS.hpp>
#include <shaders/PresentPS.hpp>

#include <algorithm>
#include <array>
#include <cmath>
#include <cwctype>
#include <filesystem>
#include <string_view>
#include <vector>

namespace anime4k::renderer {
namespace {

using Microsoft::WRL::ComPtr;
using namespace winrt::Windows::Graphics;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX;
using namespace winrt::Windows::Graphics::DirectX::Direct3D11;

constexpr wchar_t kWindowClassName[] = L"Anime4K.Native.OutputWindow";
constexpr DirectXPixelFormat kCapturePixelFormat = DirectXPixelFormat::B8G8R8A8UIntNormalized;
constexpr std::int32_t kCaptureBufferCount = 3;

std::string hresult_message(HRESULT result) {
  return win32::wide_to_utf8(winrt::hresult_error(result).message().c_str());
}

bool is_neural_upscale_mode(std::string_view mode) noexcept {
  return mode == "ANIMEJANAI";
}

std::wstring lower_case(std::wstring value) {
  std::transform(value.begin(), value.end(), value.begin(), [](wchar_t character) {
    return static_cast<wchar_t>(std::towlower(character));
  });
  return value;
}

bool is_browser_process(HWND window) {
  DWORD process_id = 0;
  GetWindowThreadProcessId(window, &process_id);
  if (process_id == 0) return false;
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
  if (process == nullptr) return false;
  std::vector<wchar_t> path(32768);
  DWORD size = static_cast<DWORD>(path.size());
  const bool success = QueryFullProcessImageNameW(process, 0, path.data(), &size) != FALSE;
  CloseHandle(process);
  if (!success) return false;
  const auto name = lower_case(std::filesystem::path(std::wstring(path.data(), size)).filename().wstring());
  return name == L"chrome.exe" || name == L"firefox.exe" || name == L"msedge.exe" || name == L"brave.exe" || name == L"vivaldi.exe";
}

struct WindowSearch {
  std::wstring nonce;
  std::vector<HWND> matches;
};

BOOL CALLBACK enumerate_windows(HWND window, LPARAM parameter) {
  auto* search = reinterpret_cast<WindowSearch*>(parameter);
  if (!IsWindowVisible(window) || GetWindow(window, GW_OWNER) != nullptr) return TRUE;
  BOOL cloaked = FALSE;
  if (SUCCEEDED(DwmGetWindowAttribute(window, DWMWA_CLOAKED, &cloaked, sizeof(cloaked))) && cloaked) return TRUE;
  const int title_length = GetWindowTextLengthW(window);
  if (title_length <= 0 || title_length > 4096) return TRUE;
  std::wstring title(static_cast<std::size_t>(title_length) + 1, L'\0');
  const int copied = GetWindowTextW(window, title.data(), static_cast<int>(title.size()));
  if (copied <= 0) return TRUE;
  title.resize(static_cast<std::size_t>(copied));
  if (title.find(search->nonce) != std::wstring::npos && is_browser_process(window)) search->matches.push_back(window);
  return TRUE;
}

json::Value make_renderer_error(const StartOptions& options, std::string code, std::string message, bool recoverable) {
  return protocol::make_error(
      std::move(code), std::move(message), std::nullopt,
      options.session_id.empty() ? std::nullopt : std::optional<std::string>(options.session_id), recoverable);
}

}  // namespace

struct CaptureRenderer::NeuralFrameCompletion {
  PipelineOutput output;
  std::string error;
  std::chrono::steady_clock::time_point started{};
  std::uint64_t job_generation{};
  std::uint64_t capture_generation{};
  std::uint64_t configuration_generation{};
  std::uint64_t resize_generation{};
  std::uint32_t source_width{};
  std::uint32_t source_height{};
  double capture_time_ms{};
  bool failed{};
  bool cancelled{};
};

CaptureRenderer::CaptureRenderer(EventSink event_sink)
    : event_sink_(std::move(event_sink)), renderer_thread_id_(GetCurrentThreadId()) {}

CaptureRenderer::~CaptureRenderer() {
  stop("renderer_shutdown");
  release_d3d();
}

bool CaptureRenderer::start(const StartOptions& options, std::string& error) {
  if (active()) {
    error = "a native capture session is already active";
    return false;
  }
  options_ = options;
  if (++configuration_generation_ == 0) ++configuration_generation_;
  neural_completion_.reset();
  neural_processing_.store(false, std::memory_order_release);
  neural_frame_waiting_.store(false, std::memory_order_release);
  output_presented_ = false;
  capture_geometry_logged_ = false;
  source_window_ = find_source_window(error);
  if (source_window_ == nullptr) return false;
  if (!initialize_d3d(error) || !initialize_output_window(source_window_, error) || !initialize_capture(source_window_, error)) {
    release_capture();
    release_output();
    release_d3d();
    source_window_ = nullptr;
    return false;
  }
  metrics_start_ = std::chrono::steady_clock::now();
  metrics_frames_ = 0;
  metrics_render_samples_ = 0;
  metrics_frame_time_ms_ = 0.0;
  dropped_frames_.store(0, std::memory_order_relaxed);
  rendered_frame_sequence_ = 0;
  latest_capture_time_ms_ = 0.0;
  last_rendered_capture_time_ms_ = 0.0;
  frame_interval_ms_ = 1000.0 / 24.0;
  health_detector_.reset();
  playback_active_ = false;
  media_time_seconds_ = 0.0;
  playback_state_received_ = {};
  active_.store(true, std::memory_order_release);
  try {
    capture_session_.StartCapture();
  } catch (const winrt::hresult_error& exception) {
    active_.store(false, std::memory_order_release);
    error = "StartCapture failed: " + win32::wide_to_utf8(exception.message().c_str());
    release_capture();
    release_output();
    source_window_ = nullptr;
    return false;
  }
  return true;
}

void CaptureRenderer::update_configuration(
    std::string mode,
    std::string quality,
    bool frame_generation_enabled) {
  if (output_window_ != nullptr) KillTimer(output_window_, kGeneratedFrameTimer);
  std::scoped_lock lock(d3d_mutex_);
  const bool neural_model_changed =
      (is_neural_upscale_mode(options_.mode) || is_neural_upscale_mode(mode)) && options_.mode != mode;
  const bool changed = options_.mode != mode || options_.quality != quality
      || options_.frame_generation_enabled != frame_generation_enabled;
  options_.mode = std::move(mode);
  options_.quality = std::move(quality);
  options_.frame_generation_enabled = frame_generation_enabled;
  if (!changed) return;
  if (++configuration_generation_ == 0) ++configuration_generation_;
  if (frame_generation_pipeline_ != nullptr) frame_generation_pipeline_->clear_resources();
  if (neural_model_changed && animejanai_pipeline_ != nullptr) animejanai_pipeline_->clear_resources();
  last_rendered_capture_time_ms_ = 0.0;
  frame_interval_ms_ = 1000.0 / 24.0;
}

void CaptureRenderer::update_playback_state(bool active, double media_time_seconds) {
  const bool was_active = playback_active_;
  playback_active_ = active;
  media_time_seconds_ = media_time_seconds;
  playback_state_received_ = std::chrono::steady_clock::now();
  if (!active && output_window_ != nullptr) KillTimer(output_window_, kGeneratedFrameTimer);
  if (was_active && !active && options_.frame_generation_enabled && this->active()) {
    std::string error;
    std::scoped_lock lock(d3d_mutex_);
    if (frame_generation_pipeline_ != nullptr && frame_generation_pipeline_->has_history()
        && !present_frame(nullptr, true, 1.0F, error) && !error.empty()) {
      win32::debug_log("renderer", "could not flush the last generated-frame history: " + error);
    }
  }
}

void CaptureRenderer::stop(std::string_view reason) {
  (void)reason;
  active_.store(false, std::memory_order_release);
  neural_worker_.request_stop();
  frame_pending_.store(false, std::memory_order_release);
  health_detector_.reset();
  playback_active_ = false;
  media_time_seconds_ = 0.0;
  playback_state_received_ = {};
  if (neural_worker_.joinable() && neural_worker_.get_id() != std::this_thread::get_id()) {
    neural_worker_.join();
  }
  neural_completion_.reset();
  neural_processing_.store(false, std::memory_order_release);
  neural_frame_waiting_.store(false, std::memory_order_release);
  reset_frame_generation();
  release_capture();
  release_output();
  source_window_ = nullptr;
}

std::string CaptureRenderer::state_message() const {
  if (!active()) return "idle";
  return "capturing " + options_.mode + "/" + options_.quality
      + (options_.frame_generation_enabled ? " + frame generation" : "");
}

bool CaptureRenderer::initialize_d3d(std::string& error) {
  if (device_ != nullptr) {
    const HRESULT removal_reason = device_->GetDeviceRemovedReason();
    const bool complete = context_ != nullptr && vertex_shader_ != nullptr && present_shader_ != nullptr
        && sampler_ != nullptr && winrt_device_ != nullptr && anime4k_pipeline_ != nullptr
        && frame_generation_pipeline_ != nullptr && animejanai_pipeline_ != nullptr;
    if (!d3d::requires_device_recreation(S_OK, removal_reason) && complete) return true;
    if (FAILED(removal_reason)) {
      win32::debug_log(
          "renderer", "recreating removed D3D11 device: " + hresult_message(removal_reason));
    }
    release_d3d();
  }
  UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
  std::array<D3D_FEATURE_LEVEL, 2> levels{D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};
  D3D_FEATURE_LEVEL selected{};
  HRESULT result = D3D11CreateDevice(
      nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION,
      &device_, &selected, &context_);
  if (result == E_INVALIDARG) {
    result = D3D11CreateDevice(
        nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, levels.data() + 1, 1, D3D11_SDK_VERSION,
        &device_, &selected, &context_);
  }
  if (FAILED(result)) {
    error = "D3D11CreateDevice failed: " + hresult_message(result);
    return false;
  }
  result = device_->CreateVertexShader(kFullscreenVS, kFullscreenVSSize, nullptr, &vertex_shader_);
  if (FAILED(result)) {
    error = "CreateVertexShader failed: " + hresult_message(result);
    return false;
  }
  result = device_->CreatePixelShader(kPresentPS, kPresentPSSize, nullptr, &present_shader_);
  if (FAILED(result)) {
    error = "Create present shader failed: " + hresult_message(result);
    return false;
  }

  D3D11_SAMPLER_DESC sampler_description{};
  sampler_description.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
  sampler_description.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.MaxLOD = D3D11_FLOAT32_MAX;
  result = device_->CreateSamplerState(&sampler_description, &sampler_);
  if (FAILED(result)) {
    error = "CreateSamplerState failed: " + hresult_message(result);
    return false;
  }

  ComPtr<IDXGIDevice> dxgi_device;
  result = device_.As(&dxgi_device);
  if (FAILED(result)) {
    error = "D3D device does not expose IDXGIDevice";
    return false;
  }
  winrt::com_ptr<IInspectable> inspectable;
  result = CreateDirect3D11DeviceFromDXGIDevice(dxgi_device.Get(), inspectable.put());
  if (FAILED(result)) {
    error = "CreateDirect3D11DeviceFromDXGIDevice failed: " + hresult_message(result);
    return false;
  }
  winrt_device_ = inspectable.as<IDirect3DDevice>();
  anime4k_pipeline_ = std::make_unique<Anime4KPipeline>(device_.Get(), context_.Get());
  animejanai_pipeline_ = std::make_unique<AnimeJanaiPipeline>(device_.Get(), context_.Get());
  frame_generation_pipeline_ = std::make_unique<FrameGenerationPipeline>(device_.Get(), context_.Get());
  return true;
}

bool CaptureRenderer::initialize_output_window(HWND source_window, std::string& error) {
  WNDCLASSEXW window_class{};
  window_class.cbSize = sizeof(window_class);
  window_class.style = CS_HREDRAW | CS_VREDRAW;
  window_class.lpfnWndProc = &CaptureRenderer::window_proc;
  window_class.hInstance = GetModuleHandleW(nullptr);
  window_class.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  window_class.lpszClassName = kWindowClassName;
  if (RegisterClassExW(&window_class) == 0 && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
    error = "RegisterClassEx failed: " + win32::last_error_message();
    return false;
  }

  const HMONITOR monitor = MonitorFromWindow(source_window, MONITOR_DEFAULTTONEAREST);
  MONITORINFO monitor_information{};
  monitor_information.cbSize = sizeof(monitor_information);
  if (!GetMonitorInfoW(monitor, &monitor_information)) {
    error = "GetMonitorInfo failed: " + win32::last_error_message();
    return false;
  }
  const auto monitor_width = static_cast<std::uint32_t>(monitor_information.rcMonitor.right - monitor_information.rcMonitor.left);
  const auto monitor_height = static_cast<std::uint32_t>(monitor_information.rcMonitor.bottom - monitor_information.rcMonitor.top);
  output_width_ = options_.target_width == 0 ? monitor_width : std::min(options_.target_width, monitor_width);
  output_height_ = options_.target_height == 0 ? monitor_height : std::min(options_.target_height, monitor_height);
  const int x = monitor_information.rcMonitor.left + static_cast<int>((monitor_width - output_width_) / 2);
  const int y = monitor_information.rcMonitor.top + static_cast<int>((monitor_height - output_height_) / 2);

  output_window_ = CreateWindowExW(
      WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
      kWindowClassName,
      L"AniWebScale Native Output",
      WS_POPUP,
      x,
      y,
      static_cast<int>(output_width_),
      static_cast<int>(output_height_),
      source_window,
      nullptr,
      GetModuleHandleW(nullptr),
      this);
  if (output_window_ == nullptr) {
    error = "CreateWindowEx failed: " + win32::last_error_message();
    return false;
  }
  // Do not activate this window: Chromium may leave the Fullscreen API when
  // another top-level window takes foreground focus. A session-scoped Esc
  // hotkey remains available without activation.
  escape_hotkey_registered_ = RegisterHotKey(output_window_, kEscapeHotkeyId, MOD_NOREPEAT, VK_ESCAPE) != FALSE;
  (void)SetWindowDisplayAffinity(output_window_, WDA_EXCLUDEFROMCAPTURE);
  return create_swap_chain(output_width_, output_height_, error);
}

bool CaptureRenderer::create_swap_chain(std::uint32_t width, std::uint32_t height, std::string& error) {
  ComPtr<IDXGIDevice> dxgi_device;
  ComPtr<IDXGIAdapter> adapter;
  ComPtr<IDXGIFactory2> factory;
  HRESULT result = device_.As(&dxgi_device);
  if (SUCCEEDED(result)) result = dxgi_device->GetAdapter(&adapter);
  if (SUCCEEDED(result)) result = adapter->GetParent(IID_PPV_ARGS(&factory));
  if (FAILED(result)) {
    error = "could not obtain DXGI factory: " + hresult_message(result);
    return false;
  }
  DXGI_SWAP_CHAIN_DESC1 description{};
  description.Width = width;
  description.Height = height;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
  description.BufferCount = 2;
  description.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
  description.Scaling = DXGI_SCALING_STRETCH;
  description.AlphaMode = DXGI_ALPHA_MODE_IGNORE;
  result = factory->CreateSwapChainForHwnd(device_.Get(), output_window_, &description, nullptr, nullptr, &swap_chain_);
  if (FAILED(result)) {
    error = "CreateSwapChainForHwnd failed: " + hresult_message(result);
    return false;
  }
  factory->MakeWindowAssociation(output_window_, DXGI_MWA_NO_ALT_ENTER | DXGI_MWA_NO_WINDOW_CHANGES);
  ComPtr<ID3D11Texture2D> back_buffer;
  result = swap_chain_->GetBuffer(0, IID_PPV_ARGS(&back_buffer));
  if (SUCCEEDED(result)) result = device_->CreateRenderTargetView(back_buffer.Get(), nullptr, &back_buffer_view_);
  if (FAILED(result)) {
    error = "CreateRenderTargetView for swap chain failed: " + hresult_message(result);
    return false;
  }
  return true;
}

bool CaptureRenderer::initialize_capture(HWND source_window, std::string& error) {
  if (!GraphicsCaptureSession::IsSupported()) {
    error = "Windows Graphics Capture is not supported on this system";
    return false;
  }
  try {
    const auto interop = winrt::get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
    winrt::check_hresult(interop->CreateForWindow(
        source_window, winrt::guid_of<GraphicsCaptureItem>(), winrt::put_abi(capture_item_)));
    const auto size = capture_item_.Size();
    if (size.Width <= 0 || size.Height <= 0) {
      error = "capture window has an invalid size";
      return false;
    }
    frame_pool_ = Direct3D11CaptureFramePool::CreateFreeThreaded(
        winrt_device_, kCapturePixelFormat, kCaptureBufferCount, size);
    capture_resize_state_.reset(
        static_cast<std::uint32_t>(size.Width), static_cast<std::uint32_t>(size.Height));
    capture_session_ = frame_pool_.CreateCaptureSession(capture_item_);
    capture_session_.IsCursorCaptureEnabled(false);
    const std::uint64_t capture_generation =
        capture_generation_.fetch_add(1, std::memory_order_acq_rel) + 1U;
    frame_arrived_token_ = frame_pool_.FrameArrived(
        [this, capture_generation](
            const Direct3D11CaptureFramePool& sender,
            const winrt::Windows::Foundation::IInspectable& arguments) {
          on_frame_arrived(sender, arguments, capture_generation);
        });
    capture_closed_token_ = capture_item_.Closed(
        [this, capture_generation](const GraphicsCaptureItem&, const winrt::Windows::Foundation::IInspectable&) {
          on_capture_closed(capture_generation);
        });
  } catch (const winrt::hresult_error& exception) {
    error = "Windows Graphics Capture initialization failed: " + win32::wide_to_utf8(exception.message().c_str());
    return false;
  }
  return true;
}

bool CaptureRenderer::ensure_capture_copy(const D3D11_TEXTURE2D_DESC& source_description, std::string& error) {
  if (latest_texture_ != nullptr) {
    D3D11_TEXTURE2D_DESC existing{};
    latest_texture_->GetDesc(&existing);
    if (existing.Width == source_description.Width && existing.Height == source_description.Height && existing.Format == source_description.Format) return true;
  }
  latest_view_.Reset();
  latest_texture_.Reset();
  capture_probe_texture_.Reset();
  D3D11_TEXTURE2D_DESC description = source_description;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.SampleDesc.Count = 1;
  description.SampleDesc.Quality = 0;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  description.CPUAccessFlags = 0;
  description.MiscFlags = 0;
  HRESULT result = device_->CreateTexture2D(&description, nullptr, &latest_texture_);
  if (SUCCEEDED(result)) result = device_->CreateShaderResourceView(latest_texture_.Get(), nullptr, &latest_view_);
  if (FAILED(result)) {
    error = "could not allocate capture copy texture: " + hresult_message(result);
    latest_texture_.Reset();
    return false;
  }
  return true;
}

void CaptureRenderer::apply_pending_capture_resize(std::uint64_t capture_generation) {
  if (!capture::should_handle_capture_window_message(
          active(), capture_generation,
          capture_generation_.load(std::memory_order_acquire))) return;
  const auto pending = capture_resize_state_.pending_extent();
  if (!pending.has_value()) return;

  frame_pending_.store(false, std::memory_order_release);
  HRESULT failure = S_OK;
  std::string failure_message;
  {
    // FrameArrived runs on the free-threaded pool's worker thread. Its callback
    // only takes this mutex with try_lock, so Recreate can never wait on a
    // callback that is itself waiting for Recreate to finish.
    std::scoped_lock frame_lock(frame_callback_mutex_);
    if (!active() || frame_pool_ == nullptr || winrt_device_ == nullptr) return;
    try {
      const SizeInt32 size{
          static_cast<std::int32_t>(pending->width),
          static_cast<std::int32_t>(pending->height),
      };
      frame_pool_.Recreate(winrt_device_, kCapturePixelFormat, kCaptureBufferCount, size);
      {
        std::scoped_lock d3d_lock(d3d_mutex_);
        latest_view_.Reset();
        latest_texture_.Reset();
        capture_probe_texture_.Reset();
        if (anime4k_pipeline_ != nullptr) anime4k_pipeline_->clear_resources();
        if (frame_generation_pipeline_ != nullptr) frame_generation_pipeline_->clear_resources();
        if (animejanai_pipeline_ != nullptr) animejanai_pipeline_->clear_resources();
        last_rendered_capture_time_ms_ = 0.0;
        frame_interval_ms_ = 1000.0 / 24.0;
      }
      if (!capture_resize_state_.mark_applied(*pending)) {
        failure = E_UNEXPECTED;
        failure_message = "capture resize state changed while applying the frame-pool resize";
      }
    } catch (const winrt::hresult_error& exception) {
      failure = exception.code();
      failure_message = "Windows Graphics Capture frame-pool resize failed: " +
          win32::wide_to_utf8(exception.message().c_str());
    }
  }

  if (SUCCEEDED(failure)) return;
  const HRESULT removal_reason = device_ == nullptr ? S_OK : device_->GetDeviceRemovedReason();
  const bool device_lost = d3d::requires_device_recreation(failure, removal_reason);
  if (device_lost && FAILED(removal_reason) && removal_reason != failure) {
    failure_message += " (D3D11 device removal reason: " + hresult_message(removal_reason) + ")";
  }
  fail_active_session(
      device_lost ? "device_lost" : "capture_resize_failed",
      std::move(failure_message),
      device_lost ? "device_lost" : "capture_resize_failed",
      "native-capture-resize-failed",
      device_lost);
}

void CaptureRenderer::handle_capture_resize_dispatch_failure(std::uint64_t capture_generation) {
  if (!capture::should_handle_capture_window_message(
          active(), capture_generation,
          capture_generation_.load(std::memory_order_acquire))) return;
  fail_active_session(
      "capture_resize_dispatch_failed",
      "Could not dispatch the capture resize to the renderer window.",
      "capture_resize_dispatch_failed",
      "native-capture-resize-dispatch-failed",
      false);
}

void CaptureRenderer::fail_active_session(
    std::string code,
    std::string message,
    std::string reason,
    std::string request_id,
    bool release_device) {
  if (!active()) return;
  const std::string session = options_.session_id;
  event_sink_(make_renderer_error(options_, std::move(code), std::move(message), true));
  stop(reason);
  if (release_device) release_d3d();
  event_sink_(json::Object{
      {"type", "stopped"},
      {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
      {"requestId", std::move(request_id)},
      {"sessionId", session},
      {"reason", std::move(reason)},
  });
}

void CaptureRenderer::release_capture() {
  capture_generation_.fetch_add(1, std::memory_order_acq_rel);
  try {
    if (frame_pool_ != nullptr) frame_pool_.FrameArrived(frame_arrived_token_);
    if (capture_item_ != nullptr) capture_item_.Closed(capture_closed_token_);
  } catch (...) {
  }
  {
    std::scoped_lock frame_lock(frame_callback_mutex_);
    try {
      if (capture_session_ != nullptr) capture_session_.Close();
      if (frame_pool_ != nullptr) frame_pool_.Close();
    } catch (...) {
    }
  }
  capture_session_ = nullptr;
  frame_pool_ = nullptr;
  capture_item_ = nullptr;
  capture_resize_state_.reset();
  std::scoped_lock lock(d3d_mutex_);
  latest_view_.Reset();
  latest_texture_.Reset();
  capture_probe_texture_.Reset();
}

void CaptureRenderer::release_output() {
  // FrameArrived retains this lifecycle lease through PostMessage. Pairing the
  // writer with the same lock prevents a checked HWND from being destroyed or
  // recycled before the asynchronous dispatch call has consumed its value.
  std::scoped_lock frame_lock(frame_callback_mutex_);
  std::scoped_lock lock(d3d_mutex_);
  if (output_window_ != nullptr) KillTimer(output_window_, kGeneratedFrameTimer);
  if (context_ != nullptr) {
    std::array<ID3D11ShaderResourceView*, 2> null_views{};
    context_->PSSetShaderResources(0, static_cast<UINT>(null_views.size()), null_views.data());
    context_->ClearState();
    context_->Flush();
  }
  if (anime4k_pipeline_ != nullptr) anime4k_pipeline_->clear_resources();
  if (frame_generation_pipeline_ != nullptr) frame_generation_pipeline_->clear_resources();
  if (animejanai_pipeline_ != nullptr) animejanai_pipeline_->clear_resources();
  back_buffer_view_.Reset();
  swap_chain_.Reset();
  const HWND window = output_window_;
  output_window_ = nullptr;
  output_presented_ = false;
  if (window != nullptr && IsWindow(window)) {
    KillTimer(window, kExitFullscreenTimer);
    if (escape_hotkey_registered_) UnregisterHotKey(window, kEscapeHotkeyId);
    DestroyWindow(window);
  }
  escape_hotkey_registered_ = false;
}

void CaptureRenderer::release_d3d() {
  neural_worker_.request_stop();
  if (neural_worker_.joinable() && neural_worker_.get_id() != std::this_thread::get_id()) {
    neural_worker_.join();
  }
  neural_completion_.reset();
  neural_processing_.store(false, std::memory_order_release);
  neural_frame_waiting_.store(false, std::memory_order_release);
  std::scoped_lock lock(d3d_mutex_);
  capture_probe_texture_.Reset();
  latest_view_.Reset();
  latest_texture_.Reset();
  animejanai_pipeline_.reset();
  frame_generation_pipeline_.reset();
  anime4k_pipeline_.reset();
  sampler_.Reset();
  present_shader_.Reset();
  vertex_shader_.Reset();
  winrt_device_ = nullptr;
  context_.Reset();
  device_.Reset();
  last_render_hresult_ = S_OK;
}

HWND CaptureRenderer::find_source_window(std::string& error) const {
  WindowSearch search{win32::utf8_to_wide(options_.window_nonce), {}};
  if (search.nonce.empty()) {
    error = "window nonce is not valid UTF-8";
    return nullptr;
  }
  EnumWindows(enumerate_windows, reinterpret_cast<LPARAM>(&search));
  if (search.matches.empty()) {
    error = "no visible browser popup contains the supplied window nonce";
    return nullptr;
  }
  if (search.matches.size() != 1) {
    error = "the window nonce matched more than one browser window";
    return nullptr;
  }
  return search.matches.front();
}

bool CaptureRenderer::process_and_present(
    ID3D11Texture2D* source_texture,
    ID3D11ShaderResourceView* source_view,
    std::uint32_t source_width,
    std::uint32_t source_height,
    double capture_time_ms,
    std::string& error) {
  last_render_hresult_ = S_OK;
  if (output_width_ == 0 || output_height_ == 0 || source_width == 0 || source_height == 0) return false;
  update_content_rectangle(source_width, source_height);
  const auto content_width = static_cast<std::uint32_t>(content_rectangle_.right - content_rectangle_.left);
  const auto content_height = static_cast<std::uint32_t>(content_rectangle_.bottom - content_rectangle_.top);

  PipelineOutput processed;
  if (options_.mode == "OFF") {
    processed.texture = source_texture;
    processed.view = source_view;
    processed.width = source_width;
    processed.height = source_height;
  } else if (is_neural_upscale_mode(options_.mode)) {
    error = "AnimeJaNai frames must be processed by the neural worker";
    return false;
  } else {
    if (anime4k_pipeline_ == nullptr) {
      error = "Anime4K compute pipeline is not initialized";
      return false;
    }
    if (!anime4k_pipeline_->execute(
            source_texture, source_view, source_width, source_height, content_width, content_height,
            options_.mode, options_.quality, processed, error)) return false;
  }
  return present_processed_frame(processed.texture.Get(), processed.view.Get(), capture_time_ms, error);
}

void CaptureRenderer::update_content_rectangle(
    std::uint32_t source_width,
    std::uint32_t source_height) noexcept {
  const auto contained = geometry::contain_rectangle(
      static_cast<int>(source_width), static_cast<int>(source_height),
      static_cast<int>(output_width_), static_cast<int>(output_height_));
  content_rectangle_ = RECT{contained.left, contained.top, contained.right, contained.bottom};
}

bool CaptureRenderer::present_processed_frame(
    ID3D11Texture2D* processed_texture,
    ID3D11ShaderResourceView* processed_view,
    double capture_time_ms,
    std::string& error) {
  if (processed_texture == nullptr || processed_view == nullptr) {
    error = "Native frame processing returned an invalid output";
    return false;
  }
  if (capture_time_ms > last_rendered_capture_time_ms_) {
    if (last_rendered_capture_time_ms_ > 0.0) {
      const double interval = capture_time_ms - last_rendered_capture_time_ms_;
      if (interval <= 200.0) frame_interval_ms_ = std::clamp(interval, 8.0, 100.0);
    }
    last_rendered_capture_time_ms_ = capture_time_ms;
  }

  bool has_intermediate = false;
  if (options_.frame_generation_enabled) {
    if (frame_generation_pipeline_ == nullptr || !frame_generation_pipeline_->push_frame(
            processed_texture, has_intermediate, error)) return false;
    if (!present_frame(nullptr, true, has_intermediate ? 0.0F : 1.0F, error)) return false;
    if (has_intermediate) schedule_generated_frame();
    return true;
  }
  return present_frame(processed_view, false, 1.0F, error);
}

bool CaptureRenderer::present_frame(
    ID3D11ShaderResourceView* source_view,
    bool interpolated,
    float interpolation_factor,
    std::string& error) {
  last_render_hresult_ = S_OK;
  if (swap_chain_ == nullptr || back_buffer_view_ == nullptr) {
    error = "Native output swap chain is not initialized";
    return false;
  }

  context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  context_->VSSetShader(vertex_shader_.Get(), nullptr, 0);
  context_->PSSetSamplers(0, 1, sampler_.GetAddressOf());

  const float black[4]{0, 0, 0, 1};
  context_->ClearRenderTargetView(back_buffer_view_.Get(), black);
  context_->OMSetRenderTargets(1, back_buffer_view_.GetAddressOf(), nullptr);
  D3D11_VIEWPORT viewport{};
  viewport.TopLeftX = static_cast<float>(content_rectangle_.left);
  viewport.TopLeftY = static_cast<float>(content_rectangle_.top);
  viewport.Width = static_cast<float>(content_rectangle_.right - content_rectangle_.left);
  viewport.Height = static_cast<float>(content_rectangle_.bottom - content_rectangle_.top);
  viewport.MaxDepth = 1.0F;
  context_->RSSetViewports(1, &viewport);
  if (interpolated) {
    if (frame_generation_pipeline_ == nullptr
        || !frame_generation_pipeline_->bind_for_presentation(interpolation_factor, error)) return false;
  } else {
    if (source_view == nullptr) {
      error = "Native presentation received an invalid source view";
      return false;
    }
    context_->PSSetShader(present_shader_.Get(), nullptr, 0);
    context_->PSSetShaderResources(0, 1, &source_view);
  }
  context_->Draw(3, 0);
  if (interpolated) {
    frame_generation_pipeline_->unbind();
  } else {
    ID3D11ShaderResourceView* null_view = nullptr;
    context_->PSSetShaderResources(0, 1, &null_view);
  }
  const HRESULT result = swap_chain_->Present(1, 0);
  if (FAILED(result)) {
    last_render_hresult_ = result;
    error = "swap-chain Present failed: " + hresult_message(result);
    return false;
  }
  ++metrics_frames_;
  if (!output_presented_) {
    // The browser popup owns this window, so it can never cover the enhanced
    // output when focus changes. Show only after the first completed frame to
    // avoid a black fullscreen flash while shaders are being prepared.
    SetWindowPos(
        output_window_, HWND_TOPMOST, 0, 0, 0, 0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_NOOWNERZORDER
          | SWP_NOACTIVATE | SWP_FRAMECHANGED);
    ShowWindow(output_window_, SW_SHOWNOACTIVATE);
    output_presented_ = true;
  }
  return true;
}

void CaptureRenderer::schedule_generated_frame() {
  if (output_window_ == nullptr) return;
  KillTimer(output_window_, kGeneratedFrameTimer);
  if (!active() || !options_.frame_generation_enabled || !playback_active_
      || frame_generation_pipeline_ == nullptr || !frame_generation_pipeline_->has_intermediate()) return;
  const auto delay = static_cast<UINT>(std::clamp(
      std::lround(frame_interval_ms_ * 0.5), 1L, 100L));
  if (SetTimer(output_window_, kGeneratedFrameTimer, delay, nullptr) == 0) {
    dropped_frames_.fetch_add(1, std::memory_order_relaxed);
  }
}

void CaptureRenderer::reset_frame_generation() noexcept {
  if (output_window_ != nullptr) KillTimer(output_window_, kGeneratedFrameTimer);
  std::scoped_lock lock(d3d_mutex_);
  if (frame_generation_pipeline_ != nullptr) frame_generation_pipeline_->clear_resources();
  last_rendered_capture_time_ms_ = 0.0;
  frame_interval_ms_ = 1000.0 / 24.0;
}

void CaptureRenderer::render_generated_frame() {
  if (output_window_ != nullptr) KillTimer(output_window_, kGeneratedFrameTimer);
  if (!active() || !options_.frame_generation_enabled || !playback_active_) return;
  std::string error;
  bool render_failed = false;
  {
    std::unique_lock lock(d3d_mutex_, std::try_to_lock);
    if (!lock.owns_lock()) {
      dropped_frames_.fetch_add(1, std::memory_order_relaxed);
      return;
    }
    if (frame_generation_pipeline_ == nullptr || !frame_generation_pipeline_->has_intermediate()) return;
    render_failed = !present_frame(nullptr, true, 0.5F, error);
  }
  if (render_failed) {
    const HRESULT removal_reason = device_ == nullptr ? S_OK : device_->GetDeviceRemovedReason();
    const bool device_lost = d3d::requires_device_recreation(last_render_hresult_, removal_reason);
    fail_active_session(
        device_lost ? "device_lost" : "frame_generation_failed",
        error.empty() ? "Native frame generation failed." : error,
        device_lost ? "device_lost" : "frame_generation_failed",
        "native-frame-generation-failed",
        device_lost);
  }
}

void CaptureRenderer::on_frame_arrived(
    const Direct3D11CaptureFramePool& sender,
    const winrt::Windows::Foundation::IInspectable&,
    std::uint64_t capture_generation) {
  if (!active() || !capture::is_current_generation(
          capture_generation, capture_generation_.load(std::memory_order_acquire))
      || capture_resize_state_.has_pending()) return;
  std::unique_lock frame_lock(frame_callback_mutex_, std::try_to_lock);
  if (!frame_lock.owns_lock() || !active() || !capture::is_current_generation(
          capture_generation, capture_generation_.load(std::memory_order_acquire))
      || capture_resize_state_.has_pending()) return;
  bool copied = false;
  bool resize_requested = false;
  try {
    {
      const auto frame = sender.TryGetNextFrame();
      if (frame == nullptr) return;
      const double capture_time_ms = std::chrono::duration<double, std::milli>(
          frame.SystemRelativeTime()).count();
      const auto content_size = frame.ContentSize();
      if (content_size.Width <= 0 || content_size.Height <= 0) return;
      resize_requested = capture_resize_state_.request(content_size.Width, content_size.Height);
      if (!resize_requested) {
        const auto access = frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
        ComPtr<ID3D11Texture2D> source;
        winrt::check_hresult(access->GetInterface(IID_PPV_ARGS(&source)));
        D3D11_TEXTURE2D_DESC description{};
        source->GetDesc(&description);
        const auto content_width = static_cast<std::uint32_t>(content_size.Width);
        const auto content_height = static_cast<std::uint32_t>(content_size.Height);
        // A frame queued before Recreate must never be copied into resources for
        // the new extent. WGC surfaces may be larger than ContentSize, but not
        // smaller; smaller surfaces are stale and are discarded.
        if (description.Width < content_width || description.Height < content_height) return;
        D3D11_BOX source_box{0, 0, 0, content_width, content_height, 1};
        D3D11_TEXTURE2D_DESC copy_description = description;
        copy_description.Width = content_width;
        copy_description.Height = content_height;
        RECT client_rectangle{};
        RECT frame_rectangle{};
        POINT client_origin{};
        if (GetClientRect(source_window_, &client_rectangle) && ClientToScreen(source_window_, &client_origin) &&
            SUCCEEDED(DwmGetWindowAttribute(
                source_window_, DWMWA_EXTENDED_FRAME_BOUNDS, &frame_rectangle, sizeof(frame_rectangle)))) {
          const LONG client_width = client_rectangle.right - client_rectangle.left;
          const LONG client_height = client_rectangle.bottom - client_rectangle.top;
          const LONG offset_x = client_origin.x - frame_rectangle.left;
          const LONG offset_y = client_origin.y - frame_rectangle.top;
          if (client_width > 0 && client_height > 0 && offset_x >= 0 && offset_y >= 0 &&
              static_cast<std::uint64_t>(offset_x) + static_cast<std::uint64_t>(client_width) <= content_width &&
              static_cast<std::uint64_t>(offset_y) + static_cast<std::uint64_t>(client_height) <= content_height) {
            source_box.left = static_cast<UINT>(offset_x);
            source_box.top = static_cast<UINT>(offset_y);
            source_box.right = source_box.left + static_cast<UINT>(client_width);
            source_box.bottom = source_box.top + static_cast<UINT>(client_height);
            copy_description.Width = static_cast<UINT>(client_width);
            copy_description.Height = static_cast<UINT>(client_height);
          }
        }
        if (options_.capture_width >= 64U && options_.capture_height >= 64U) {
          const UINT available_width = source_box.right - source_box.left;
          const UINT available_height = source_box.bottom - source_box.top;
          const auto crop = geometry::clip_capture_region(
              static_cast<int>(available_width), static_cast<int>(available_height),
              static_cast<int>(options_.capture_x), static_cast<int>(options_.capture_y),
              static_cast<int>(options_.capture_width), static_cast<int>(options_.capture_height));
          if (crop.has_value()) {
            source_box.left += static_cast<UINT>(crop->left);
            source_box.top += static_cast<UINT>(crop->top);
            source_box.right = source_box.left + static_cast<UINT>(crop->right - crop->left);
            source_box.bottom = source_box.top + static_cast<UINT>(crop->bottom - crop->top);
            copy_description.Width = static_cast<UINT>(crop->right - crop->left);
            copy_description.Height = static_cast<UINT>(crop->bottom - crop->top);
          }
        }
        if (!capture_geometry_logged_) {
          win32::debug_log(
              "renderer",
              "capture geometry requested=" + std::to_string(options_.capture_x) + ","
                  + std::to_string(options_.capture_y) + " "
                  + std::to_string(options_.capture_width) + "x" + std::to_string(options_.capture_height)
                  + " frame=" + std::to_string(content_width) + "x" + std::to_string(content_height)
                  + " applied=" + std::to_string(source_box.left) + "," + std::to_string(source_box.top) + " "
                  + std::to_string(copy_description.Width) + "x" + std::to_string(copy_description.Height));
          capture_geometry_logged_ = true;
        }
        std::string error;
        {
          std::scoped_lock lock(d3d_mutex_);
          // stop() and a replacement capture can both win while this callback
          // waits for neural processing. Never copy or dispatch work for that
          // stale frame after acquiring the serialized D3D context.
          if (!active() || !capture::is_current_generation(
                  capture_generation, capture_generation_.load(std::memory_order_acquire))
              || capture_resize_state_.has_pending()) return;
          if (!ensure_capture_copy(copy_description, error)) {
            event_sink_(make_renderer_error(options_, "capture_copy_failed", error, true));
            return;
          }
          context_->CopySubresourceRegion(latest_texture_.Get(), 0, 0, 0, 0, source.Get(), 0, &source_box);
          latest_capture_time_ms_ = capture_time_ms;
        }
        copied = true;
      }
    }
    // The frame object has gone out of scope before Recreate is dispatched, as
    // required because Recreate discards every checked-out frame in the pool.
    // Keep the lifecycle mutex until PostMessage has consumed the HWND value;
    // release_output() takes the same mutex before nulling/destroying it.
    const HWND output = output_window_;
    if (!capture::should_dispatch_capture_window_message(
            active(), capture_generation,
            capture_generation_.load(std::memory_order_acquire), output != nullptr)) return;
    if (resize_requested) {
      frame_pending_.store(false, std::memory_order_release);
      if (PostMessageW(
              output, kCaptureResizeMessage,
              static_cast<WPARAM>(capture_generation), 0)) return;
      frame_lock.unlock();
      if (active() && capture::is_current_generation(
              capture_generation, capture_generation_.load(std::memory_order_acquire))
          && !PostThreadMessageW(
              renderer_thread_id_, kCaptureResizeDispatchFailedMessage,
              static_cast<WPARAM>(capture_generation), 0)) {
        // The renderer thread creates its message queue before this object. A
        // failure here therefore means shutdown is already underway or the
        // queue is unusable; notify the browser so its idempotent cleanup still
        // restores the source tab.
        event_sink_(make_renderer_error(
            options_, "capture_resize_dispatch_failed", "Could not dispatch the capture resize to the renderer thread.", true));
      }
      return;
    }
    if (!copied) return;
    if (frame_pending_.exchange(true, std::memory_order_acq_rel)) {
      dropped_frames_.fetch_add(1, std::memory_order_relaxed);
    } else if (!PostMessageW(
                   output, kFrameReadyMessage,
                   static_cast<WPARAM>(capture_generation), 0)) {
      // A failed post must not leave coalescing permanently latched. If the
      // session is still live, the next captured frame gets another attempt.
      frame_pending_.store(false, std::memory_order_release);
      dropped_frames_.fetch_add(1, std::memory_order_relaxed);
    }
  } catch (const winrt::hresult_error& exception) {
    event_sink_(make_renderer_error(options_, "capture_frame_failed", win32::wide_to_utf8(exception.message().c_str()), true));
  }
}

void CaptureRenderer::on_capture_closed(std::uint64_t capture_generation) {
  if (!capture::is_current_generation(
          capture_generation, capture_generation_.load(std::memory_order_acquire))) return;
  if (!PostThreadMessageW(
          renderer_thread_id_, kCaptureClosedMessage, static_cast<WPARAM>(capture_generation), 0)) {
    event_sink_(make_renderer_error(
        options_, "capture_close_dispatch_failed",
        "Could not dispatch capture closure to the renderer thread.", true));
  }
}

void CaptureRenderer::handle_capture_closed(std::uint64_t capture_generation) {
  if (!capture::should_handle_close(
          active(), capture_generation, capture_generation_.load(std::memory_order_acquire))) return;
  const std::string session = options_.session_id;
  stop("capture_window_closed");
  event_sink_(json::Object{
      {"type", "stopped"},
      {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
      {"requestId", "native-capture-closed"},
      {"sessionId", session},
      {"reason", "capture_window_closed"},
  });
}

void CaptureRenderer::render_latest_frame(std::uint64_t capture_generation) {
  if (!capture::should_handle_capture_window_message(
          active(), capture_generation,
          capture_generation_.load(std::memory_order_acquire))) return;
  if (neural_processing_.load(std::memory_order_acquire)) {
    // Leave frame_pending_ set so WGC coalesces every newer compositor frame
    // into a single replacement while the native model is running.
    neural_frame_waiting_.store(true, std::memory_order_release);
    return;
  }
  frame_pending_.store(false, std::memory_order_release);
  if (output_window_ != nullptr) KillTimer(output_window_, kGeneratedFrameTimer);
  if (!active() || capture_resize_state_.has_pending()) return;
  const auto started = std::chrono::steady_clock::now();
  std::string error;
  capture::HealthState health = capture::HealthState::healthy;
  bool render_failed = false;
  bool run_neural_async = false;
  ComPtr<ID3D11Texture2D> neural_source;
  ComPtr<ID3D11ShaderResourceView> neural_source_view;
  D3D11_TEXTURE2D_DESC neural_description{};
  double neural_capture_time_ms = 0.0;
  std::uint64_t neural_capture_generation = 0;
  std::uint64_t neural_configuration_generation = 0;
  std::uint64_t neural_resize_generation = 0;
  std::uint64_t neural_job_generation = 0;
  HWND completion_window = nullptr;
  {
    std::scoped_lock frame_lock(frame_callback_mutex_);
    if (capture_resize_state_.has_pending()) return;
    std::scoped_lock lock(d3d_mutex_);
    if (latest_texture_ == nullptr || latest_view_ == nullptr) return;
    D3D11_TEXTURE2D_DESC description{};
    latest_texture_->GetDesc(&description);
    ++rendered_frame_sequence_;
    if (rendered_frame_sequence_ % 15U == 0U) {
      std::string probe_warning;
      health = probe_capture_health(description, probe_warning);
      if (!probe_warning.empty()) win32::debug_log("renderer", "capture health probe: " + probe_warning);
    }
    if (health == capture::HealthState::healthy) {
      if (is_neural_upscale_mode(options_.mode)) {
        neural_source = latest_texture_;
        neural_source_view = latest_view_;
        neural_description = description;
        neural_capture_time_ms = latest_capture_time_ms_;
        neural_capture_generation = capture_generation_.load(std::memory_order_acquire);
        neural_configuration_generation = configuration_generation_;
        neural_resize_generation = capture_resize_state_.generation();
        if (++neural_job_generation_ == 0) ++neural_job_generation_;
        neural_job_generation = neural_job_generation_;
        completion_window = output_window_;
        neural_completion_.reset();
        neural_processing_.store(true, std::memory_order_release);
        run_neural_async = true;
      } else if (!process_and_present(
                     latest_texture_.Get(), latest_view_.Get(), description.Width, description.Height,
                     latest_capture_time_ms_, error)) {
        render_failed = true;
      }
    }
  }
  if (run_neural_async) {
    if (neural_worker_.joinable()) neural_worker_.join();
    neural_worker_ = std::jthread([
        this,
        source = std::move(neural_source),
        source_view = std::move(neural_source_view),
        description = neural_description,
        capture_time_ms = neural_capture_time_ms,
        capture_generation = neural_capture_generation,
        configuration_generation = neural_configuration_generation,
        resize_generation = neural_resize_generation,
        job_generation = neural_job_generation,
        completion_window,
        started](std::stop_token stop_token) {
      auto completion = std::make_unique<NeuralFrameCompletion>();
      completion->started = started;
      completion->job_generation = job_generation;
      completion->capture_generation = capture_generation;
      completion->configuration_generation = configuration_generation;
      completion->resize_generation = resize_generation;
      completion->source_width = description.Width;
      completion->source_height = description.Height;
      completion->capture_time_ms = capture_time_ms;
      {
        std::scoped_lock lock(d3d_mutex_);
        const capture::NeuralGenerationSnapshot job_generations{
            capture_generation, configuration_generation, resize_generation};
        const auto current_generations = [this]() {
          return capture::NeuralGenerationSnapshot{
              capture_generation_.load(std::memory_order_acquire),
              configuration_generation_,
              capture_resize_state_.generation(),
          };
        };
        if (!capture::should_process_neural_frame(
                stop_token.stop_requested(), active(), is_neural_upscale_mode(options_.mode),
                capture_resize_state_.has_pending(), job_generations, current_generations())) {
          completion->cancelled = true;
        } else if (animejanai_pipeline_ == nullptr) {
          completion->failed = true;
          completion->error = "AnimeJaNai DirectML pipeline is not initialized";
        } else if (!animejanai_pipeline_->execute(
                       source.Get(), source_view.Get(), description.Width, description.Height,
                       completion->output, completion->error)) {
          completion->failed = true;
        }
        if (!completion->failed && !capture::should_process_neural_frame(
                stop_token.stop_requested(), active(), is_neural_upscale_mode(options_.mode),
                capture_resize_state_.has_pending(), job_generations, current_generations())) {
          completion->cancelled = true;
        }
      }
      if (stop_token.stop_requested() || !active()) completion->cancelled = true;
      neural_completion_ = std::move(completion);
      if (completion_window == nullptr ||
          !PostMessageW(
              completion_window, kNeuralFrameCompleteMessage,
              static_cast<WPARAM>(job_generation), 0)) {
        neural_processing_.store(false, std::memory_order_release);
      }
    });
    return;
  }
  if (render_failed) {
    const HRESULT removal_reason = device_ == nullptr ? S_OK : device_->GetDeviceRemovedReason();
    const bool device_lost = d3d::requires_device_recreation(last_render_hresult_, removal_reason);
    if (device_lost && FAILED(removal_reason) && removal_reason != last_render_hresult_) {
      error += " (D3D11 device removal reason: " + hresult_message(removal_reason) + ")";
    }
    fail_active_session(
        device_lost ? "device_lost" : "render_failed",
        error.empty() ? "Native frame rendering failed." : std::move(error),
        device_lost ? "device_lost" : "render_failed",
        device_lost ? "native-render-device-lost" : "native-render-failed",
        device_lost);
    return;
  }
  if (health != capture::HealthState::healthy) {
    const std::string session = options_.session_id;
    event_sink_(make_renderer_error(options_, "protected_capture_blocked", capture::kProtectedCaptureMessage, false));
    stop("protected_content");
    event_sink_(json::Object{
        {"type", "stopped"},
        {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
        {"requestId", "native-protected-content"},
        {"sessionId", session},
        {"reason", "protected_content"},
    });
    return;
  }
  const double elapsed = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - started).count();
  emit_metrics(elapsed);
}

void CaptureRenderer::finish_neural_frame(std::uint64_t neural_job_generation) {
  if (!neural_processing_.load(std::memory_order_acquire)) return;
  if (neural_job_generation != neural_job_generation_) return;
  if (neural_worker_.joinable()) neural_worker_.join();
  if (neural_completion_ == nullptr
      || neural_completion_->job_generation != neural_job_generation) return;
  auto completion = std::move(neural_completion_);
  neural_processing_.store(false, std::memory_order_release);

  const auto render_waiting_frame = [this, capture_generation = completion->capture_generation]() {
    if (!capture::should_handle_capture_window_message(
            active(), capture_generation,
            capture_generation_.load(std::memory_order_acquire))) return;
    if (neural_frame_waiting_.exchange(false, std::memory_order_acq_rel)) {
      frame_pending_.store(false, std::memory_order_release);
      if (output_window_ != nullptr) {
        PostMessageW(
            output_window_, kFrameReadyMessage,
            static_cast<WPARAM>(capture_generation), 0);
      }
    }
  };
  if (completion->cancelled
      || !capture::should_present_neural_completion(
          active(), is_neural_upscale_mode(options_.mode), capture_resize_state_.has_pending(),
          {completion->capture_generation, completion->configuration_generation, completion->resize_generation},
          {capture_generation_.load(std::memory_order_acquire),
           configuration_generation_, capture_resize_state_.generation()})) {
    render_waiting_frame();
    return;
  }
  if (completion->failed) {
    const HRESULT removal_reason = device_ == nullptr ? S_OK : device_->GetDeviceRemovedReason();
    const bool device_lost = d3d::requires_device_recreation(S_OK, removal_reason);
    std::string error = std::move(completion->error);
    if (device_lost && FAILED(removal_reason)) {
      error += " (D3D11 device removal reason: " + hresult_message(removal_reason) + ")";
    }
    fail_active_session(
        device_lost ? "device_lost" : "render_failed",
        error.empty() ? "Native ONNX upscaler inference failed." : std::move(error),
        device_lost ? "device_lost" : "render_failed",
        device_lost ? "native-render-device-lost" : "native-neural-upscale-failed",
        device_lost);
    return;
  }

  std::string error;
  bool render_failed = false;
  {
    std::scoped_lock lock(d3d_mutex_);
    if (!capture::should_present_neural_completion(
            active(), is_neural_upscale_mode(options_.mode), capture_resize_state_.has_pending(),
            {completion->capture_generation, completion->configuration_generation, completion->resize_generation},
            {capture_generation_.load(std::memory_order_acquire),
             configuration_generation_, capture_resize_state_.generation()})) {
      render_waiting_frame();
      return;
    }
    update_content_rectangle(completion->source_width, completion->source_height);
    last_render_hresult_ = S_OK;
    render_failed = !present_processed_frame(
        completion->output.texture.Get(), completion->output.view.Get(),
        completion->capture_time_ms, error);
  }
  if (render_failed) {
    const HRESULT removal_reason = device_ == nullptr ? S_OK : device_->GetDeviceRemovedReason();
    const bool device_lost = d3d::requires_device_recreation(last_render_hresult_, removal_reason);
    if (device_lost && FAILED(removal_reason) && removal_reason != last_render_hresult_) {
      error += " (D3D11 device removal reason: " + hresult_message(removal_reason) + ")";
    }
    fail_active_session(
        device_lost ? "device_lost" : "render_failed",
        error.empty() ? "Native ONNX upscaler presentation failed." : std::move(error),
        device_lost ? "device_lost" : "render_failed",
        device_lost ? "native-render-device-lost" : "native-neural-upscale-failed",
        device_lost);
    return;
  }
  emit_metrics(std::chrono::duration<double, std::milli>(
      std::chrono::steady_clock::now() - completion->started).count());
  render_waiting_frame();
}

capture::HealthState CaptureRenderer::probe_capture_health(
    const D3D11_TEXTURE2D_DESC& description,
    std::string& warning) {
  if (description.Format != DXGI_FORMAT_B8G8R8A8_UNORM && description.Format != DXGI_FORMAT_B8G8R8A8_UNORM_SRGB) {
    return capture::HealthState::healthy;
  }
  const std::uint32_t patch = std::min({8U, description.Width, description.Height});
  if (patch == 0) return capture::HealthState::healthy;
  const std::uint32_t probe_width = patch * 5U;
  bool recreate = capture_probe_texture_ == nullptr;
  if (!recreate) {
    D3D11_TEXTURE2D_DESC existing{};
    capture_probe_texture_->GetDesc(&existing);
    recreate = existing.Width != probe_width || existing.Height != patch || existing.Format != description.Format;
  }
  if (recreate) {
    capture_probe_texture_.Reset();
    D3D11_TEXTURE2D_DESC probe_description{};
    probe_description.Width = probe_width;
    probe_description.Height = patch;
    probe_description.MipLevels = 1;
    probe_description.ArraySize = 1;
    probe_description.Format = description.Format;
    probe_description.SampleDesc.Count = 1;
    probe_description.Usage = D3D11_USAGE_STAGING;
    probe_description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    const HRESULT result = device_->CreateTexture2D(&probe_description, nullptr, &capture_probe_texture_);
    if (FAILED(result)) {
      warning = "could not create probe texture: " + hresult_message(result);
      return capture::HealthState::healthy;
    }
  }

  const std::array<std::pair<std::uint32_t, std::uint32_t>, 5> origins{{
      {0, 0},
      {description.Width - patch, 0},
      {(description.Width - patch) / 2U, (description.Height - patch) / 2U},
      {0, description.Height - patch},
      {description.Width - patch, description.Height - patch},
  }};
  for (std::uint32_t index = 0; index < origins.size(); ++index) {
    D3D11_BOX box{};
    box.left = origins[index].first;
    box.top = origins[index].second;
    box.front = 0;
    box.right = box.left + patch;
    box.bottom = box.top + patch;
    box.back = 1;
    context_->CopySubresourceRegion(capture_probe_texture_.Get(), 0, index * patch, 0, 0, latest_texture_.Get(), 0, &box);
  }
  D3D11_MAPPED_SUBRESOURCE mapped{};
  const HRESULT map_result = context_->Map(capture_probe_texture_.Get(), 0, D3D11_MAP_READ, 0, &mapped);
  if (FAILED(map_result)) {
    warning = "could not map probe texture: " + hresult_message(map_result);
    return capture::HealthState::healthy;
  }
  std::uint32_t black_pixels = 0;
  const std::uint32_t total_pixels = probe_width * patch;
  std::uint64_t fingerprint = 1469598103934665603ULL;
  for (std::uint32_t row = 0; row < patch; ++row) {
    const auto* bytes = static_cast<const std::uint8_t*>(mapped.pData) + static_cast<std::size_t>(row) * mapped.RowPitch;
    for (std::uint32_t column = 0; column < probe_width; ++column) {
      const std::uint8_t blue = bytes[column * 4U];
      const std::uint8_t green = bytes[column * 4U + 1U];
      const std::uint8_t red = bytes[column * 4U + 2U];
      if (blue <= 4U && green <= 4U && red <= 4U) ++black_pixels;
      fingerprint ^= blue;
      fingerprint *= 1099511628211ULL;
      fingerprint ^= green;
      fingerprint *= 1099511628211ULL;
      fingerprint ^= red;
      fingerprint *= 1099511628211ULL;
    }
  }
  context_->Unmap(capture_probe_texture_.Get(), 0);
  const auto now = std::chrono::steady_clock::now();
  const auto timestamp = static_cast<std::uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count());
  const bool heartbeat_fresh = playback_state_received_.time_since_epoch().count() != 0
      && now - playback_state_received_ <= std::chrono::seconds(3);
  return health_detector_.observe(
      capture::is_effectively_black(black_pixels, total_pixels),
      fingerprint,
      timestamp,
      playback_active_ && heartbeat_fresh,
      media_time_seconds_);
}

void CaptureRenderer::emit_metrics(double frame_time_ms) {
  ++metrics_render_samples_;
  metrics_frame_time_ms_ += frame_time_ms;
  const auto now = std::chrono::steady_clock::now();
  const double seconds = std::chrono::duration<double>(now - metrics_start_).count();
  if (seconds < 1.0) return;
  event_sink_(json::Object{
      {"type", "metrics"},
      {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
      {"sessionId", options_.session_id},
      {"fps", static_cast<double>(metrics_frames_) / seconds},
      {"frameTimeMs", metrics_render_samples_ == 0
          ? 0.0
          : metrics_frame_time_ms_ / static_cast<double>(metrics_render_samples_)},
      {"droppedFrames", static_cast<double>(dropped_frames_.load(std::memory_order_relaxed))},
  });
  metrics_start_ = now;
  metrics_frames_ = 0;
  metrics_render_samples_ = 0;
  metrics_frame_time_ms_ = 0.0;
}

void CaptureRenderer::emit_pointer(UINT message, WPARAM wparam, LPARAM lparam) {
  if (!active()) return;
  POINT point{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
  if (message == WM_MOUSEWHEEL) ScreenToClient(output_window_, &point);
  const auto normalized = geometry::normalize_pointer(
      {content_rectangle_.left, content_rectangle_.top, content_rectangle_.right, content_rectangle_.bottom}, point.x, point.y);
  if (!normalized.has_value()) return;
  std::string event = "move";
  int button = -1;
  if (message == WM_LBUTTONDOWN || message == WM_RBUTTONDOWN || message == WM_MBUTTONDOWN) event = "down";
  if (message == WM_LBUTTONUP || message == WM_RBUTTONUP || message == WM_MBUTTONUP) event = "up";
  if (message == WM_MOUSEWHEEL) event = "wheel";
  if (message == WM_LBUTTONDOWN || message == WM_LBUTTONUP) button = 0;
  if (message == WM_RBUTTONDOWN || message == WM_RBUTTONUP) button = 2;
  if (message == WM_MBUTTONDOWN || message == WM_MBUTTONUP) button = 1;
  const auto key_state = static_cast<std::uintptr_t>(LOWORD(wparam));
  json::Object object{
      {"type", "pointer"},
      {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
      {"requestId", "native-pointer-" + std::to_string(++pointer_sequence_)},
      {"sessionId", options_.session_id},
      {"event", event},
      {"x", normalized->x},
      {"y", normalized->y},
      {"button", button},
      {"buttons", geometry::dom_buttons_from_win32(key_state)},
      {"shiftKey", (key_state & MK_SHIFT) != 0},
      {"ctrlKey", (key_state & MK_CONTROL) != 0},
      {"altKey", (GetKeyState(VK_MENU) & 0x8000) != 0},
  };
  if (message == WM_MOUSEWHEEL) {
    object.emplace("deltaY", geometry::dom_wheel_delta_from_win32(GET_WHEEL_DELTA_WPARAM(wparam)));
  }
  event_sink_(std::move(object));
}

void CaptureRenderer::emit_fullscreen_exit(HWND window) {
  event_sink_(json::Object{
      {"type", "mediaCommand"},
      {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
      {"requestId", "native-key-" + std::to_string(++pointer_sequence_)},
      {"sessionId", options_.session_id},
      {"command", "exitFullscreen"},
  });
  // The extension confirms that the browser left fullscreen and normally
  // stops us first. Keep rendering until then; this timer is only the final
  // cleanup path for a crashed/unresponsive browser.
  SetTimer(window, kExitFullscreenTimer, 5000, nullptr);
}

LRESULT CALLBACK CaptureRenderer::window_proc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  CaptureRenderer* self = reinterpret_cast<CaptureRenderer*>(GetWindowLongPtrW(window, GWLP_USERDATA));
  if (message == WM_NCCREATE) {
    const auto* create = reinterpret_cast<const CREATESTRUCTW*>(lparam);
    self = static_cast<CaptureRenderer*>(create->lpCreateParams);
    SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
  }
  if (self == nullptr) return DefWindowProcW(window, message, wparam, lparam);

  switch (message) {
    case kFrameReadyMessage:
      self->render_latest_frame(static_cast<std::uint64_t>(wparam));
      return 0;
    case kNeuralFrameCompleteMessage:
      self->finish_neural_frame(static_cast<std::uint64_t>(wparam));
      return 0;
    case kCaptureResizeMessage:
      self->apply_pending_capture_resize(static_cast<std::uint64_t>(wparam));
      return 0;
    case kCaptureClosedMessage: {
      self->handle_capture_closed(static_cast<std::uint64_t>(wparam));
      return 0;
    }
    case WM_CLOSE:
      PostMessageW(
          window, kCaptureClosedMessage,
          static_cast<WPARAM>(self->capture_generation_.load(std::memory_order_acquire)), 0);
      return 0;
    case WM_TIMER:
      if (wparam == kExitFullscreenTimer) {
        KillTimer(window, kExitFullscreenTimer);
        PostMessageW(
            window, kCaptureClosedMessage,
            static_cast<WPARAM>(self->capture_generation_.load(std::memory_order_acquire)), 0);
        return 0;
      }
      if (wparam == kGeneratedFrameTimer) {
        KillTimer(window, kGeneratedFrameTimer);
        self->render_generated_frame();
        return 0;
      }
      return DefWindowProcW(window, message, wparam, lparam);
    case WM_HOTKEY:
      if (wparam == kEscapeHotkeyId) {
        self->emit_fullscreen_exit(window);
        return 0;
      }
      return DefWindowProcW(window, message, wparam, lparam);
    case WM_MOUSEMOVE:
    case WM_LBUTTONDOWN:
    case WM_LBUTTONUP:
    case WM_RBUTTONDOWN:
    case WM_RBUTTONUP:
    case WM_MBUTTONDOWN:
    case WM_MBUTTONUP:
    case WM_MOUSEWHEEL:
      if (message == WM_LBUTTONDOWN || message == WM_RBUTTONDOWN || message == WM_MBUTTONDOWN) SetCapture(window);
      if (message == WM_LBUTTONUP || message == WM_RBUTTONUP || message == WM_MBUTTONUP) ReleaseCapture();
      self->emit_pointer(message, wparam, lparam);
      return 0;
    case WM_KEYDOWN: {
      std::string command;
      double value = 0.0;
      bool has_value = false;
      if (wparam == VK_SPACE) command = "playPause";
      else if (wparam == VK_LEFT) { command = "seekBy"; value = -5.0; has_value = true; }
      else if (wparam == VK_RIGHT) { command = "seekBy"; value = 5.0; has_value = true; }
      else if (wparam == VK_UP) { command = "volumeBy"; value = 0.05; has_value = true; }
      else if (wparam == VK_DOWN) { command = "volumeBy"; value = -0.05; has_value = true; }
      else if (wparam == 'M') command = "toggleMute";
      else if (wparam == 'F' || wparam == VK_ESCAPE) {
        self->emit_fullscreen_exit(window);
        return 0;
      }
      if (!command.empty()) {
        json::Object object{
            {"type", "mediaCommand"},
            {"protocolVersion", static_cast<int>(protocol::kProtocolVersion)},
            {"requestId", "native-key-" + std::to_string(++self->pointer_sequence_)},
            {"sessionId", self->options_.session_id},
            {"command", command},
        };
        if (has_value) object.emplace("value", value);
        self->event_sink_(std::move(object));
      }
      return 0;
    }
    case WM_ERASEBKGND:
      return 1;
    case WM_NCDESTROY:
      if (self->active()) {
        PostThreadMessageW(
            self->renderer_thread_id_, kCaptureClosedMessage,
            static_cast<WPARAM>(self->capture_generation_.load(std::memory_order_acquire)), 0);
      }
      SetWindowLongPtrW(window, GWLP_USERDATA, 0);
      return DefWindowProcW(window, message, wparam, lparam);
    default:
      return DefWindowProcW(window, message, wparam, lparam);
  }
}

}  // namespace anime4k::renderer
