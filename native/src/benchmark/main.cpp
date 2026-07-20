#include "anime4k/json.hpp"
#include "anime4k/win32_util.hpp"
#include "anime4k_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <dxgi1_6.h>
#include <wrl/client.h>

#include <shaders/FullscreenVS.hpp>
#include <shaders/PresentPS.hpp>

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <cwchar>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <numeric>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace {

using Microsoft::WRL::ComPtr;

constexpr std::uint32_t kSourceWidth = 1920;
constexpr std::uint32_t kSourceHeight = 1080;
constexpr std::uint32_t kTargetWidth = 2560;
constexpr std::uint32_t kTargetHeight = 1440;
constexpr double kFrameBudgetMs = 1000.0 / 24.0;

struct Options {
  std::filesystem::path output;
  std::uint32_t warmup_frames{2};
  std::uint32_t sample_frames{12};
  double maximum_seconds{600.0};
  double gpu_timeout_seconds{30.0};
  std::wstring required_adapter{L"RX 6750 XT"};
};

struct DeviceContext {
  ComPtr<IDXGIAdapter1> adapter;
  DXGI_ADAPTER_DESC1 description{};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  ComPtr<IDXGIAdapter3> adapter3;
  D3D_FEATURE_LEVEL feature_level{};
};

struct VideoMemorySnapshot {
  bool available{};
  std::uint64_t usage{};
  std::uint64_t budget{};
};

std::wstring lower_case(std::wstring value) {
  std::transform(value.begin(), value.end(), value.begin(), [](wchar_t character) {
    return static_cast<wchar_t>(std::towlower(character));
  });
  return value;
}

std::optional<std::uint32_t> parse_uint(std::wstring_view text) {
  if (text.empty()) return std::nullopt;
  wchar_t* end = nullptr;
  const unsigned long value = std::wcstoul(text.data(), &end, 10);
  if (end == text.data() || *end != L'\0' || value > std::numeric_limits<std::uint32_t>::max()) return std::nullopt;
  return static_cast<std::uint32_t>(value);
}

std::optional<double> parse_double(std::wstring_view text) {
  if (text.empty()) return std::nullopt;
  wchar_t* end = nullptr;
  const double value = std::wcstod(text.data(), &end);
  if (end == text.data() || *end != L'\0' || !std::isfinite(value)) return std::nullopt;
  return value;
}

std::optional<Options> parse_options(int count, wchar_t** values, std::string& error) {
  Options options;
  for (int index = 1; index < count; ++index) {
    const std::wstring_view argument(values[index]);
    if (argument == L"--output" && index + 1 < count) {
      options.output = values[++index];
    } else if (argument == L"--warmup" && index + 1 < count) {
      const auto value = parse_uint(values[++index]);
      if (!value.has_value() || *value > 10) {
        error = "--warmup must be an integer from 0 to 10";
        return std::nullopt;
      }
      options.warmup_frames = *value;
    } else if (argument == L"--samples" && index + 1 < count) {
      const auto value = parse_uint(values[++index]);
      if (!value.has_value() || *value == 0 || *value > 60) {
        error = "--samples must be an integer from 1 to 60";
        return std::nullopt;
      }
      options.sample_frames = *value;
    } else if (argument == L"--max-seconds" && index + 1 < count) {
      const auto value = parse_double(values[++index]);
      if (!value.has_value() || *value < 30.0 || *value > 1800.0) {
        error = "--max-seconds must be from 30 to 1800";
        return std::nullopt;
      }
      options.maximum_seconds = *value;
    } else if (argument == L"--gpu-timeout-seconds" && index + 1 < count) {
      const auto value = parse_double(values[++index]);
      if (!value.has_value() || *value < 1.0 || *value > 120.0) {
        error = "--gpu-timeout-seconds must be from 1 to 120";
        return std::nullopt;
      }
      options.gpu_timeout_seconds = *value;
    } else if (argument == L"--require-adapter" && index + 1 < count) {
      options.required_adapter = values[++index];
      if (options.required_adapter.empty() || options.required_adapter.size() > 128) {
        error = "--require-adapter must be a non-empty name fragment";
        return std::nullopt;
      }
    } else if (argument == L"--allow-any-adapter") {
      options.required_adapter.clear();
    } else {
      error = "unknown or incomplete argument: " + anime4k::win32::wide_to_utf8(argument);
      return std::nullopt;
    }
  }
  return options;
}

std::string hresult_message(HRESULT result) {
  return anime4k::win32::last_error_message(static_cast<DWORD>(result));
}

std::optional<DeviceContext> create_hardware_device(const Options& options, std::string& error) {
  ComPtr<IDXGIFactory1> factory1;
  HRESULT result = CreateDXGIFactory1(IID_PPV_ARGS(&factory1));
  if (FAILED(result)) {
    error = "CreateDXGIFactory1 failed: " + hresult_message(result);
    return std::nullopt;
  }
  std::vector<ComPtr<IDXGIAdapter1>> adapters;
  ComPtr<IDXGIFactory6> factory6;
  if (SUCCEEDED(factory1.As(&factory6))) {
    for (UINT index = 0;; ++index) {
      ComPtr<IDXGIAdapter1> adapter;
      result = factory6->EnumAdapterByGpuPreference(index, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&adapter));
      if (result == DXGI_ERROR_NOT_FOUND) break;
      if (FAILED(result)) continue;
      adapters.push_back(std::move(adapter));
    }
  } else {
    for (UINT index = 0;; ++index) {
      ComPtr<IDXGIAdapter1> adapter;
      result = factory1->EnumAdapters1(index, &adapter);
      if (result == DXGI_ERROR_NOT_FOUND) break;
      if (FAILED(result)) continue;
      adapters.push_back(std::move(adapter));
    }
  }

  const std::wstring required = lower_case(options.required_adapter);
  for (const auto& adapter : adapters) {
    DXGI_ADAPTER_DESC1 description{};
    if (FAILED(adapter->GetDesc1(&description)) || (description.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) != 0) continue;
    if (!required.empty() && lower_case(description.Description).find(required) == std::wstring::npos) continue;

    DeviceContext candidate;
    candidate.adapter = adapter;
    candidate.description = description;
    constexpr std::array<D3D_FEATURE_LEVEL, 2> levels{D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};
    result = D3D11CreateDevice(
        adapter.Get(), D3D_DRIVER_TYPE_UNKNOWN, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION,
        &candidate.device, &candidate.feature_level, &candidate.context);
    if (result == E_INVALIDARG) {
      result = D3D11CreateDevice(
          adapter.Get(), D3D_DRIVER_TYPE_UNKNOWN, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
          levels.data() + 1, 1, D3D11_SDK_VERSION,
          &candidate.device, &candidate.feature_level, &candidate.context);
    }
    if (FAILED(result)) continue;
    (void)adapter.As(&candidate.adapter3);
    return candidate;
  }
  error = required.empty()
      ? "no hardware D3D11 adapter could be initialized"
      : "required hardware adapter was not found: " + anime4k::win32::wide_to_utf8(options.required_adapter);
  return std::nullopt;
}

VideoMemorySnapshot query_video_memory(IDXGIAdapter3* adapter) {
  VideoMemorySnapshot snapshot;
  if (adapter == nullptr) return snapshot;
  DXGI_QUERY_VIDEO_MEMORY_INFO information{};
  if (SUCCEEDED(adapter->QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &information))) {
    snapshot.available = true;
    snapshot.usage = information.CurrentUsage;
    snapshot.budget = information.Budget;
  }
  return snapshot;
}

std::string utc_timestamp() {
  const std::time_t value = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
  std::tm utc{};
  gmtime_s(&utc, &value);
  std::ostringstream stream;
  stream << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return stream.str();
}

class BenchmarkRenderer {
 public:
  explicit BenchmarkRenderer(DeviceContext& device)
      : device_(device.device), context_(device.context), pipeline_(device.device.Get(), device.context.Get()) {}

  [[nodiscard]] bool initialize(std::string& error) {
    std::vector<std::uint32_t> pixels(static_cast<std::size_t>(kSourceWidth) * kSourceHeight);
    for (std::uint32_t y = 0; y < kSourceHeight; ++y) {
      for (std::uint32_t x = 0; x < kSourceWidth; ++x) {
        const std::uint8_t red = static_cast<std::uint8_t>((x / 8U + y / 16U) & 0xFFU);
        const std::uint8_t green = static_cast<std::uint8_t>(((x ^ y) + y / 4U) & 0xFFU);
        const std::uint8_t blue = static_cast<std::uint8_t>(((x / 3U) ^ (y / 5U)) & 0xFFU);
        pixels[static_cast<std::size_t>(y) * kSourceWidth + x] =
            0xFF000000U | (static_cast<std::uint32_t>(red) << 16U) |
            (static_cast<std::uint32_t>(green) << 8U) | blue;
      }
    }
    D3D11_TEXTURE2D_DESC source_description{};
    source_description.Width = kSourceWidth;
    source_description.Height = kSourceHeight;
    source_description.MipLevels = 1;
    source_description.ArraySize = 1;
    source_description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    source_description.SampleDesc.Count = 1;
    source_description.Usage = D3D11_USAGE_DEFAULT;
    source_description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    D3D11_SUBRESOURCE_DATA source_data{};
    source_data.pSysMem = pixels.data();
    source_data.SysMemPitch = kSourceWidth * sizeof(std::uint32_t);
    HRESULT result = device_->CreateTexture2D(&source_description, &source_data, &source_texture_);
    if (SUCCEEDED(result)) result = device_->CreateShaderResourceView(source_texture_.Get(), nullptr, &source_view_);
    if (FAILED(result)) {
      error = "could not create synthetic source: " + hresult_message(result);
      return false;
    }

    D3D11_TEXTURE2D_DESC target_description{};
    target_description.Width = kTargetWidth;
    target_description.Height = kTargetHeight;
    target_description.MipLevels = 1;
    target_description.ArraySize = 1;
    target_description.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
    target_description.SampleDesc.Count = 1;
    target_description.Usage = D3D11_USAGE_DEFAULT;
    target_description.BindFlags = D3D11_BIND_RENDER_TARGET;
    result = device_->CreateTexture2D(&target_description, nullptr, &target_texture_);
    if (SUCCEEDED(result)) result = device_->CreateRenderTargetView(target_texture_.Get(), nullptr, &target_view_);
    if (SUCCEEDED(result)) result = device_->CreateVertexShader(kFullscreenVS, kFullscreenVSSize, nullptr, &vertex_shader_);
    if (SUCCEEDED(result)) result = device_->CreatePixelShader(kPresentPS, kPresentPSSize, nullptr, &present_shader_);
    if (FAILED(result)) {
      error = "could not create final resize target/shaders: " + hresult_message(result);
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
      error = "could not create final resize sampler: " + hresult_message(result);
      return false;
    }

    D3D11_QUERY_DESC disjoint_description{D3D11_QUERY_TIMESTAMP_DISJOINT, 0};
    D3D11_QUERY_DESC timestamp_description{D3D11_QUERY_TIMESTAMP, 0};
    result = device_->CreateQuery(&disjoint_description, &disjoint_query_);
    if (SUCCEEDED(result)) result = device_->CreateQuery(&timestamp_description, &start_query_);
    if (SUCCEEDED(result)) result = device_->CreateQuery(&timestamp_description, &end_query_);
    if (FAILED(result)) {
      error = "could not create D3D11 timestamp queries: " + hresult_message(result);
      return false;
    }
    return true;
  }

  [[nodiscard]] bool execute_frame(
      std::string_view mode,
      std::string_view quality,
      double timeout_seconds,
      double& gpu_ms,
      std::string& error) {
    context_->Begin(disjoint_query_.Get());
    context_->End(start_query_.Get());

    anime4k::renderer::PipelineOutput processed;
    const bool processed_ok = pipeline_.execute(
        source_texture_.Get(), source_view_.Get(), kSourceWidth, kSourceHeight,
        kTargetWidth, kTargetHeight, mode, quality, processed, error);
    if (processed_ok) {
      D3D11_VIEWPORT viewport{};
      viewport.Width = static_cast<float>(kTargetWidth);
      viewport.Height = static_cast<float>(kTargetHeight);
      viewport.MaxDepth = 1.0F;
      context_->OMSetRenderTargets(1, target_view_.GetAddressOf(), nullptr);
      context_->RSSetViewports(1, &viewport);
      context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
      context_->VSSetShader(vertex_shader_.Get(), nullptr, 0);
      context_->PSSetShader(present_shader_.Get(), nullptr, 0);
      context_->PSSetSamplers(0, 1, sampler_.GetAddressOf());
      ID3D11ShaderResourceView* view = processed.view.Get();
      context_->PSSetShaderResources(0, 1, &view);
      context_->Draw(3, 0);
      ID3D11ShaderResourceView* null_view = nullptr;
      context_->PSSetShaderResources(0, 1, &null_view);
      ID3D11RenderTargetView* null_target = nullptr;
      context_->OMSetRenderTargets(1, &null_target, nullptr);
    }

    context_->End(end_query_.Get());
    context_->End(disjoint_query_.Get());
    context_->Flush();
    if (!processed_ok) return false;

    D3D11_QUERY_DATA_TIMESTAMP_DISJOINT disjoint{};
    std::uint64_t start_timestamp = 0;
    std::uint64_t end_timestamp = 0;
    if (!wait_for_query(disjoint_query_.Get(), &disjoint, sizeof(disjoint), timeout_seconds, error) ||
        !wait_for_query(start_query_.Get(), &start_timestamp, sizeof(start_timestamp), timeout_seconds, error) ||
        !wait_for_query(end_query_.Get(), &end_timestamp, sizeof(end_timestamp), timeout_seconds, error)) {
      return false;
    }
    if (disjoint.Disjoint || disjoint.Frequency == 0 || end_timestamp < start_timestamp) {
      error = "GPU timestamp interval was disjoint";
      return false;
    }
    gpu_ms = static_cast<double>(end_timestamp - start_timestamp) * 1000.0 / static_cast<double>(disjoint.Frequency);
    return std::isfinite(gpu_ms) && gpu_ms >= 0.0;
  }

 private:
  [[nodiscard]] bool wait_for_query(
      ID3D11Query* query,
      void* data,
      UINT size,
      double timeout_seconds,
      std::string& error) {
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::duration<double>(timeout_seconds);
    while (true) {
      const HRESULT result = context_->GetData(query, data, size, D3D11_ASYNC_GETDATA_DONOTFLUSH);
      if (result == S_OK) return true;
      if (FAILED(result)) {
        error = "D3D11 query failed: " + hresult_message(result);
        return false;
      }
      if (std::chrono::steady_clock::now() >= deadline) {
        error = "GPU completion query exceeded the configured timeout";
        return false;
      }
      std::this_thread::yield();
    }
  }

  ComPtr<ID3D11Device> device_;
  ComPtr<ID3D11DeviceContext> context_;
  anime4k::renderer::Anime4KPipeline pipeline_;
  ComPtr<ID3D11Texture2D> source_texture_;
  ComPtr<ID3D11ShaderResourceView> source_view_;
  ComPtr<ID3D11Texture2D> target_texture_;
  ComPtr<ID3D11RenderTargetView> target_view_;
  ComPtr<ID3D11VertexShader> vertex_shader_;
  ComPtr<ID3D11PixelShader> present_shader_;
  ComPtr<ID3D11SamplerState> sampler_;
  ComPtr<ID3D11Query> disjoint_query_;
  ComPtr<ID3D11Query> start_query_;
  ComPtr<ID3D11Query> end_query_;
};

double percentile_nearest_rank(std::vector<double> values, double percentile) {
  if (values.empty()) return 0.0;
  std::sort(values.begin(), values.end());
  const auto rank = static_cast<std::size_t>(std::ceil(percentile * static_cast<double>(values.size())));
  return values[std::clamp<std::size_t>(rank, 1, values.size()) - 1];
}

bool is_release_performance_target(std::string_view mode, std::string_view quality) {
  // Double-stage UL remains available as an explicit high-load profile. On the
  // reference RX 6750 XT it is intentionally outside the 24 FPS release
  // baseline; all other shipped combinations are part of that baseline.
  return quality != "UL" || (mode != "AA" && mode != "BB" && mode != "CA");
}

anime4k::json::Value optional_bytes(bool available, std::uint64_t value) {
  return available ? anime4k::json::Value(static_cast<double>(value)) : anime4k::json::Value(nullptr);
}

bool write_report(const Options& options, const anime4k::json::Value& report, std::string& error) {
  const std::string encoded = anime4k::json::stringify(report);
  if (options.output.empty()) {
    std::cout << encoded << '\n';
    return true;
  }
  std::error_code filesystem_error;
  const auto parent = options.output.parent_path();
  if (!parent.empty()) std::filesystem::create_directories(parent, filesystem_error);
  if (filesystem_error) {
    error = "could not create benchmark output directory: " + filesystem_error.message();
    return false;
  }
  std::ofstream stream(options.output, std::ios::binary | std::ios::trunc);
  if (!stream) {
    error = "could not open benchmark output file";
    return false;
  }
  stream << encoded << '\n';
  if (!stream) {
    error = "could not write benchmark output file";
    return false;
  }
  return true;
}

}  // namespace

int wmain(int argument_count, wchar_t** argument_values) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  std::string error;
  const auto options = parse_options(argument_count, argument_values, error);
  if (!options.has_value()) {
    std::cerr << error << '\n';
    return 2;
  }
  auto hardware = create_hardware_device(*options, error);
  if (!hardware.has_value()) {
    std::cerr << error << '\n';
    return 3;
  }
  BenchmarkRenderer renderer(*hardware);
  if (!renderer.initialize(error)) {
    std::cerr << error << '\n';
    return 4;
  }

  const VideoMemorySnapshot baseline_memory = query_video_memory(hardware->adapter3.Get());
  std::uint64_t overall_peak_usage = baseline_memory.usage;
  const auto benchmark_started = std::chrono::steady_clock::now();
  const auto overall_deadline = benchmark_started + std::chrono::duration<double>(options->maximum_seconds);
  const auto frame_timeout_seconds = [&]() {
    const double remaining = std::chrono::duration<double>(
        overall_deadline - std::chrono::steady_clock::now()).count();
    return std::max(0.001, std::min(options->gpu_timeout_seconds, remaining));
  };
  bool complete = true;
  bool release_performance_passed = true;
  bool all_presets_performance_passed = true;
  anime4k::json::Array preset_results;
  constexpr std::array<std::string_view, 9> modes{
      "A", "B", "C", "AA", "BB", "CA", "ARTCNN", "ACNET", "ARNET"};
  constexpr std::array<std::string_view, 3> qualities{"M", "VL", "UL"};

  for (const auto mode : modes) {
    for (const auto quality : qualities) {
      if ((mode == "ARTCNN" || mode == "ACNET" || mode == "ARNET") && quality != "M") continue;
      anime4k::json::Object result{
          {"mode", std::string(mode)},
          {"quality", std::string(quality)},
          {"warmupFramesRequested", static_cast<double>(options->warmup_frames)},
          {"samplesRequested", static_cast<double>(options->sample_frames)},
          {"frameBudgetMs", kFrameBudgetMs},
          {"releaseTarget", is_release_performance_target(mode, quality)},
      };
      if (std::chrono::steady_clock::now() >= overall_deadline) {
        complete = false;
        result.emplace("status", "skipped_overall_time_limit");
        result.emplace("samplesCompleted", 0);
        preset_results.emplace_back(std::move(result));
        continue;
      }

      bool failed = false;
      std::string preset_error;
      for (std::uint32_t frame = 0; frame < options->warmup_frames; ++frame) {
        double discarded = 0.0;
        if (std::chrono::steady_clock::now() >= overall_deadline ||
            !renderer.execute_frame(mode, quality, frame_timeout_seconds(), discarded, preset_error)) {
          failed = true;
          break;
        }
        const auto memory = query_video_memory(hardware->adapter3.Get());
        if (memory.available) overall_peak_usage = std::max(overall_peak_usage, memory.usage);
      }

      std::vector<double> samples;
      std::uint64_t preset_peak_usage = query_video_memory(hardware->adapter3.Get()).usage;
      if (!failed) {
        for (std::uint32_t frame = 0; frame < options->sample_frames; ++frame) {
          if (std::chrono::steady_clock::now() >= overall_deadline) {
            preset_error = "overall benchmark time limit reached";
            failed = true;
            break;
          }
          double gpu_ms = 0.0;
          if (!renderer.execute_frame(mode, quality, frame_timeout_seconds(), gpu_ms, preset_error)) {
            failed = true;
            break;
          }
          samples.push_back(gpu_ms);
          const auto memory = query_video_memory(hardware->adapter3.Get());
          if (memory.available) {
            preset_peak_usage = std::max(preset_peak_usage, memory.usage);
            overall_peak_usage = std::max(overall_peak_usage, memory.usage);
          }
        }
      }

      result.emplace("samplesCompleted", static_cast<double>(samples.size()));
      if (samples.empty()) {
        complete = false;
        result.emplace("status", "failed");
        result.emplace("error", preset_error.empty() ? "no samples completed" : preset_error);
        result.emplace("localVramPeakBytes", optional_bytes(baseline_memory.available, preset_peak_usage));
        preset_results.emplace_back(std::move(result));
        continue;
      }

      const double sum = std::accumulate(samples.begin(), samples.end(), 0.0);
      const double average = sum / static_cast<double>(samples.size());
      const double p50 = percentile_nearest_rank(samples, 0.50);
      const double p95 = percentile_nearest_rank(samples, 0.95);
      std::uint32_t budget_misses = 0;
      std::uint64_t dropped_estimate = 0;
      anime4k::json::Array raw_samples;
      for (const double sample : samples) {
        raw_samples.emplace_back(sample);
        if (sample > kFrameBudgetMs) ++budget_misses;
        dropped_estimate += static_cast<std::uint64_t>(std::max(0.0, std::ceil(sample / kFrameBudgetMs) - 1.0));
      }
      if (budget_misses != 0) {
        all_presets_performance_passed = false;
        if (is_release_performance_target(mode, quality)) release_performance_passed = false;
      }
      if (failed || samples.size() != options->sample_frames) complete = false;
      result.emplace("status", failed ? "partial" : budget_misses != 0 ? "over-budget" : "ok");
      if (failed) result.emplace("error", preset_error);
      result.emplace("averageMs", average);
      result.emplace("p50Ms", p50);
      result.emplace("p95Ms", p95);
      result.emplace("fps", average > 0.0 ? 1000.0 / average : 0.0);
      result.emplace("fpsFromP50", p50 > 0.0 ? 1000.0 / p50 : 0.0);
      result.emplace("budgetMisses", static_cast<double>(budget_misses));
      result.emplace("droppedFrameEstimate", static_cast<double>(dropped_estimate));
      result.emplace("localVramPeakBytes", optional_bytes(baseline_memory.available, preset_peak_usage));
      result.emplace("samplesMs", std::move(raw_samples));
      preset_results.emplace_back(std::move(result));
    }
  }

  const VideoMemorySnapshot final_memory = query_video_memory(hardware->adapter3.Get());
  if (final_memory.available) overall_peak_usage = std::max(overall_peak_usage, final_memory.usage);
  const double elapsed_seconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - benchmark_started).count();
  std::ostringstream luid;
  luid << std::hex << std::setfill('0') << std::setw(8) << static_cast<std::uint32_t>(hardware->description.AdapterLuid.HighPart)
       << std::setw(8) << hardware->description.AdapterLuid.LowPart;
  anime4k::json::Object adapter{
      {"description", anime4k::win32::wide_to_utf8(hardware->description.Description)},
      {"vendorId", static_cast<double>(hardware->description.VendorId)},
      {"deviceId", static_cast<double>(hardware->description.DeviceId)},
      {"luid", luid.str()},
      {"dedicatedVideoMemoryBytes", static_cast<double>(hardware->description.DedicatedVideoMemory)},
      {"featureLevel", hardware->feature_level == D3D_FEATURE_LEVEL_11_1 ? "11_1" : "11_0"},
  };
  anime4k::json::Array release_target_exclusions;
  for (const std::string_view mode : {"AA", "BB", "CA"}) {
    release_target_exclusions.emplace_back(anime4k::json::Object{
        {"mode", std::string(mode)},
        {"quality", "UL"},
    });
  }
  anime4k::json::Object report{
      {"schemaVersion", 2},
      {"benchmark", "Anime4K D3D11 1080p-to-1440p"},
      {"generatedAtUtc", utc_timestamp()},
      {"complete", complete},
      {"acceptancePassed", complete && release_performance_passed},
      {"allPresetsWithinFrameBudget", complete && all_presets_performance_passed},
      {"acceptancePolicy", "24 FPS for all profiles except the explicit high-load AA/BB/CA UL combinations"},
      {"releaseTargetExclusions", std::move(release_target_exclusions)},
      {"adapter", std::move(adapter)},
      {"sourceWidth", static_cast<double>(kSourceWidth)},
      {"sourceHeight", static_cast<double>(kSourceHeight)},
      {"targetWidth", static_cast<double>(kTargetWidth)},
      {"targetHeight", static_cast<double>(kTargetHeight)},
      {"warmupFramesPerPreset", static_cast<double>(options->warmup_frames)},
      {"samplesPerPreset", static_cast<double>(options->sample_frames)},
      {"frameBudgetFps", 24},
      {"frameBudgetMs", kFrameBudgetMs},
      {"elapsedSeconds", elapsed_seconds},
      {"maximumSeconds", options->maximum_seconds},
      {"gpuQueryTimeoutSeconds", options->gpu_timeout_seconds},
      {"localVramTelemetryAvailable", baseline_memory.available},
      {"localVramBaselineBytes", optional_bytes(baseline_memory.available, baseline_memory.usage)},
      {"localVramPeakBytes", optional_bytes(baseline_memory.available, overall_peak_usage)},
      {"localVramPeakDeltaBytes", optional_bytes(
          baseline_memory.available, overall_peak_usage >= baseline_memory.usage ? overall_peak_usage - baseline_memory.usage : 0)},
      {"localVramBudgetBytes", optional_bytes(final_memory.available, final_memory.budget)},
      {"presets", std::move(preset_results)},
  };

  if (!write_report(*options, report, error)) {
    std::cerr << error << '\n';
    return 5;
  }
  if (!options->output.empty()) std::wcout << L"Benchmark report: " << options->output.wstring() << L'\n';
  if (!complete) return 6;
  return release_performance_passed ? 0 : 7;
}
