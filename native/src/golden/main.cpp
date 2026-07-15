#include "anime4k_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <wrl/client.h>

#include <array>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace {

using Microsoft::WRL::ComPtr;

constexpr std::uint32_t kSourceWidth = 96;
constexpr std::uint32_t kSourceHeight = 54;
constexpr std::uint32_t kTwoXWidth = 192;
constexpr std::uint32_t kTwoXHeight = 108;
constexpr std::uint32_t kFourXWidth = 384;
constexpr std::uint32_t kFourXHeight = 216;

struct Options {
  std::filesystem::path input;
  std::filesystem::path output_directory;
  D3D_DRIVER_TYPE driver_type{D3D_DRIVER_TYPE_HARDWARE};
};

std::optional<Options> parse_options(int count, wchar_t** values) {
  Options options;
  for (int index = 1; index < count; ++index) {
    const std::wstring_view argument(values[index]);
    if (argument == L"--output-dir" && index + 1 < count) {
      options.output_directory = values[++index];
    } else if (argument == L"--input" && index + 1 < count) {
      options.input = values[++index];
    } else if (argument == L"--warp") {
      options.driver_type = D3D_DRIVER_TYPE_WARP;
    } else {
      return std::nullopt;
    }
  }
  if (options.input.empty() || options.output_directory.empty()) return std::nullopt;
  return options;
}

std::optional<std::vector<std::uint8_t>> read_fixture(const std::filesystem::path& path) {
  std::ifstream stream(path, std::ios::binary | std::ios::ate);
  if (!stream || stream.tellg() != static_cast<std::streamoff>(kSourceWidth * kSourceHeight * 4U)) {
    return std::nullopt;
  }
  std::vector<std::uint8_t> pixels(static_cast<std::size_t>(stream.tellg()));
  stream.seekg(0);
  stream.read(reinterpret_cast<char*>(pixels.data()), static_cast<std::streamsize>(pixels.size()));
  if (!stream) return std::nullopt;
  return pixels;
}

bool write_texture(
    ID3D11Device* device,
    ID3D11DeviceContext* context,
    ID3D11Texture2D* texture,
    const std::filesystem::path& path,
    std::uint32_t expected_width,
    std::uint32_t expected_height,
    std::string& error) {
  D3D11_TEXTURE2D_DESC description{};
  texture->GetDesc(&description);
  if (description.Format != DXGI_FORMAT_R16G16B16A16_FLOAT
      || description.Width != expected_width || description.Height != expected_height) {
    error = "pipeline returned an unexpected texture descriptor";
    return false;
  }

  D3D11_TEXTURE2D_DESC staging_description = description;
  staging_description.Usage = D3D11_USAGE_STAGING;
  staging_description.BindFlags = 0;
  staging_description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  staging_description.MiscFlags = 0;
  ComPtr<ID3D11Texture2D> staging;
  HRESULT result = device->CreateTexture2D(&staging_description, nullptr, &staging);
  if (FAILED(result)) {
    error = "could not create the readback texture";
    return false;
  }
  context->CopyResource(staging.Get(), texture);

  D3D11_MAPPED_SUBRESOURCE mapped{};
  result = context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped);
  if (FAILED(result)) {
    error = "could not map the readback texture";
    return false;
  }

  std::ofstream stream(path, std::ios::binary | std::ios::trunc);
  if (!stream) {
    context->Unmap(staging.Get(), 0);
    error = "could not open the output file";
    return false;
  }
  const std::size_t row_size = static_cast<std::size_t>(expected_width) * 8U;
  for (std::uint32_t row = 0; row < expected_height; ++row) {
    const auto* source = static_cast<const char*>(mapped.pData) + static_cast<std::size_t>(row) * mapped.RowPitch;
    stream.write(source, static_cast<std::streamsize>(row_size));
  }
  context->Unmap(staging.Get(), 0);
  if (!stream) {
    error = "could not write the complete output texture";
    return false;
  }
  return true;
}

}  // namespace

int wmain(int count, wchar_t** values) {
  const auto options = parse_options(count, values);
  if (!options.has_value()) {
    std::cerr << "Usage: Anime4K.Golden.exe --input <96x54.rgba8> --output-dir <directory> [--warp]\n";
    return EXIT_FAILURE;
  }

  std::error_code directory_error;
  std::filesystem::create_directories(options->output_directory, directory_error);
  if (directory_error) {
    std::cerr << "Could not create output directory\n";
    return EXIT_FAILURE;
  }

  D3D_FEATURE_LEVEL feature_level{};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  constexpr std::array<D3D_FEATURE_LEVEL, 2> levels{D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};
  HRESULT result = D3D11CreateDevice(
      nullptr, options->driver_type, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      levels.data(), static_cast<UINT>(levels.size()), D3D11_SDK_VERSION,
      &device, &feature_level, &context);
  if (result == E_INVALIDARG) {
    result = D3D11CreateDevice(
        nullptr, options->driver_type, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        levels.data() + 1, 1, D3D11_SDK_VERSION,
        &device, &feature_level, &context);
  }
  if (FAILED(result)) {
    std::cerr << "Could not create the D3D11 device\n";
    return EXIT_FAILURE;
  }

  const auto fixture = read_fixture(options->input);
  if (!fixture.has_value()) {
    std::cerr << "Input must be exactly one 96x54 RGBA8 frame\n";
    return EXIT_FAILURE;
  }
  D3D11_TEXTURE2D_DESC source_description{};
  source_description.Width = kSourceWidth;
  source_description.Height = kSourceHeight;
  source_description.MipLevels = 1;
  source_description.ArraySize = 1;
  source_description.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
  source_description.SampleDesc.Count = 1;
  source_description.Usage = D3D11_USAGE_DEFAULT;
  source_description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  D3D11_SUBRESOURCE_DATA source_data{};
  source_data.pSysMem = fixture->data();
  source_data.SysMemPitch = kSourceWidth * 4U;
  ComPtr<ID3D11Texture2D> source_texture;
  ComPtr<ID3D11ShaderResourceView> source_view;
  result = device->CreateTexture2D(&source_description, &source_data, &source_texture);
  if (SUCCEEDED(result)) result = device->CreateShaderResourceView(source_texture.Get(), nullptr, &source_view);
  if (FAILED(result)) {
    std::cerr << "Could not create the deterministic source texture\n";
    return EXIT_FAILURE;
  }

  anime4k::renderer::Anime4KPipeline pipeline(device.Get(), context.Get());
  constexpr std::array<const char*, 6> modes{"A", "B", "C", "AA", "BB", "CA"};
  constexpr std::array<const char*, 3> repeated_modes{"AA", "BB", "CA"};
  constexpr std::array<const char*, 3> qualities{"M", "VL", "UL"};
  for (const char* mode : modes) {
    for (const char* quality : qualities) {
      anime4k::renderer::PipelineOutput output;
      std::string error;
      if (!pipeline.execute(
              source_texture.Get(), source_view.Get(), kSourceWidth, kSourceHeight,
              kTwoXWidth, kTwoXHeight, mode, quality, output, error)) {
        std::cerr << mode << '/' << quality << ": " << error << '\n';
        return EXIT_FAILURE;
      }
      const std::filesystem::path path = options->output_directory /
          (std::string(mode) + '_' + quality + ".rgba16f");
      if (!write_texture(
              device.Get(), context.Get(), output.texture.Get(), path,
              kTwoXWidth, kTwoXHeight, error)) {
        std::cerr << mode << '/' << quality << ": " << error << '\n';
        return EXIT_FAILURE;
      }
      std::cout << mode << '/' << quality << '\n';
    }
  }
  for (const char* mode : repeated_modes) {
    for (const char* quality : qualities) {
      anime4k::renderer::PipelineOutput output;
      std::string error;
      if (!pipeline.execute(
              source_texture.Get(), source_view.Get(), kSourceWidth, kSourceHeight,
              kFourXWidth, kFourXHeight, mode, quality, output, error)) {
        std::cerr << mode << '/' << quality << " 4x: " << error << '\n';
        return EXIT_FAILURE;
      }
      const std::filesystem::path path = options->output_directory /
          (std::string(mode) + '_' + quality + "_4x.rgba16f");
      if (!write_texture(
              device.Get(), context.Get(), output.texture.Get(), path,
              kFourXWidth, kFourXHeight, error)) {
        std::cerr << mode << '/' << quality << " 4x: " << error << '\n';
        return EXIT_FAILURE;
      }
      std::cout << mode << '/' << quality << " 4x\n";
    }
  }
  return EXIT_SUCCESS;
}
