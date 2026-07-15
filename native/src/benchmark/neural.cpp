#include "animejanai_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wrl/client.h>
#include <winrt/base.h>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>

namespace {

using Microsoft::WRL::ComPtr;

constexpr std::uint32_t kSourceWidth = 1920;
constexpr std::uint32_t kSourceHeight = 1080;
constexpr std::uint32_t kWarmupFrames = 1;
constexpr std::uint32_t kSampleFrames = 5;

}  // namespace

int wmain() {
  winrt::init_apartment(winrt::apartment_type::multi_threaded);
  D3D_FEATURE_LEVEL feature_level{};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  const HRESULT device_result = D3D11CreateDevice(
      nullptr,
      D3D_DRIVER_TYPE_HARDWARE,
      nullptr,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      nullptr,
      0,
      D3D11_SDK_VERSION,
      &device,
      &feature_level,
      &context);
  if (FAILED(device_result)) {
    std::cerr << "Could not create a hardware D3D11 device\n";
    return EXIT_FAILURE;
  }

  std::wstring adapter_name = L"Unknown adapter";
  ComPtr<IDXGIDevice> dxgi_device;
  ComPtr<IDXGIAdapter> adapter;
  if (SUCCEEDED(device.As(&dxgi_device)) && SUCCEEDED(dxgi_device->GetAdapter(&adapter))) {
    DXGI_ADAPTER_DESC description{};
    if (SUCCEEDED(adapter->GetDesc(&description))) adapter_name = description.Description;
  }

  std::vector<std::uint32_t> pixels(static_cast<std::size_t>(kSourceWidth) * kSourceHeight);
  for (std::uint32_t y = 0; y < kSourceHeight; ++y) {
    for (std::uint32_t x = 0; x < kSourceWidth; ++x) {
      const auto red = static_cast<std::uint8_t>((x / 8U + y / 16U) & 0xFFU);
      const auto green = static_cast<std::uint8_t>(((x ^ y) + y / 4U) & 0xFFU);
      const auto blue = static_cast<std::uint8_t>(((x / 3U) ^ (y / 5U)) & 0xFFU);
      pixels[static_cast<std::size_t>(y) * kSourceWidth + x] =
          0xFF000000U | (static_cast<std::uint32_t>(red) << 16U) |
          (static_cast<std::uint32_t>(green) << 8U) | blue;
    }
  }
  D3D11_TEXTURE2D_DESC description{};
  description.Width = kSourceWidth;
  description.Height = kSourceHeight;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  D3D11_SUBRESOURCE_DATA data{};
  data.pSysMem = pixels.data();
  data.SysMemPitch = kSourceWidth * sizeof(std::uint32_t);
  ComPtr<ID3D11Texture2D> source;
  if (FAILED(device->CreateTexture2D(&description, &data, &source))) {
    std::cerr << "Could not create the synthetic 1080p source texture\n";
    return EXIT_FAILURE;
  }

  ComPtr<ID3D11ShaderResourceView> source_view;
  if (FAILED(device->CreateShaderResourceView(source.Get(), nullptr, &source_view))) {
    std::cerr << "Could not create the source view\n";
    return EXIT_FAILURE;
  }
  anime4k::renderer::AnimeJanaiPipeline pipeline(device.Get(), context.Get());
  std::vector<double> samples;
  for (std::uint32_t frame = 0; frame < kWarmupFrames + kSampleFrames; ++frame) {
    anime4k::renderer::PipelineOutput output;
    std::string error;
    const auto started = std::chrono::steady_clock::now();
    if (!pipeline.execute(
            source.Get(), source_view.Get(), kSourceWidth, kSourceHeight, output, error)) {
      std::cerr << "AnimeJaNai benchmark failed: " << error << '\n';
      return EXIT_FAILURE;
    }
    context->Flush();
    const double elapsed_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - started).count();
    if (frame >= kWarmupFrames) samples.push_back(elapsed_ms);
  }

  std::sort(samples.begin(), samples.end());
  const double average = std::accumulate(samples.begin(), samples.end(), 0.0) / samples.size();
  const double median = samples[samples.size() / 2];
  std::wcout << L"Adapter: " << adapter_name << L'\n';
  std::cout << std::fixed << std::setprecision(2)
            << "AnimeJaNai HD V3.1 Performance, 1920x1080 -> 3840x2160\n"
            << "Average: " << average << " ms (" << 1000.0 / average << " fps)\n"
            << "Median:  " << median << " ms (" << 1000.0 / median << " fps)\n"
            << "Samples:";
  for (const double sample : samples) std::cout << ' ' << sample;
  std::cout << " ms\n";
  return EXIT_SUCCESS;
}
