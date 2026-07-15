#include "animejanai_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <wrl/client.h>
#include <winrt/base.h>

#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

namespace anime4k::renderer {

struct AnimeJanaiPipelineTestAccess {
  static void simulate_partial_initialization(AnimeJanaiPipeline& pipeline) {
    pipeline.copy_shader_.Reset();
  }

  [[nodiscard]] static bool initialization_complete(const AnimeJanaiPipeline& pipeline) {
    return pipeline.module_ != nullptr && pipeline.api_ != nullptr && pipeline.aji_ != nullptr
        && pipeline.vertex_shader_ != nullptr && pipeline.copy_shader_ != nullptr
        && pipeline.sampler_ != nullptr;
  }
};

}  // namespace anime4k::renderer

namespace {

using Microsoft::WRL::ComPtr;

bool texture_has_rgb_data(
    ID3D11Device* device,
    ID3D11DeviceContext* context,
    ID3D11Texture2D* texture,
    std::uint32_t first_column,
    std::uint32_t last_column) {
  D3D11_TEXTURE2D_DESC description{};
  texture->GetDesc(&description);
  description.Usage = D3D11_USAGE_STAGING;
  description.BindFlags = 0;
  description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  description.MiscFlags = 0;
  ComPtr<ID3D11Texture2D> staging;
  if (FAILED(device->CreateTexture2D(&description, nullptr, &staging))) return false;
  context->CopyResource(staging.Get(), texture);
  D3D11_MAPPED_SUBRESOURCE mapped{};
  if (FAILED(context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return false;
  first_column = (std::min)(first_column, description.Width);
  last_column = (std::min)(last_column, description.Width);
  const std::uint32_t bytes_per_pixel = description.Format == DXGI_FORMAT_R10G10B10A2_UNORM ? 4U : 8U;
  const std::uint32_t rgb_bytes = (std::min)(bytes_per_pixel, 6U);
  bool nonzero_rgb = false;
  for (std::uint32_t row = 0; row < description.Height && !nonzero_rgb; ++row) {
    const auto* bytes = static_cast<const std::uint8_t*>(mapped.pData) + static_cast<std::size_t>(row) * mapped.RowPitch;
    for (std::uint32_t column = first_column; column < last_column && !nonzero_rgb; ++column) {
      const auto* pixel = bytes + static_cast<std::size_t>(column) * bytes_per_pixel;
      for (std::uint32_t channel_byte = 0; channel_byte < rgb_bytes; ++channel_byte) {
        if (pixel[channel_byte] != 0) {
          nonzero_rgb = true;
          break;
        }
      }
    }
  }
  context->Unmap(staging.Get(), 0);
  return nonzero_rgb;
}

}  // namespace

int main() {
  winrt::init_apartment(winrt::apartment_type::multi_threaded);
  if (anime4k::renderer::AnimeJanaiPipeline::find_runtime_directory().empty()) {
    std::cerr << "A packaged neural upscale runtime was not found\n";
    return EXIT_FAILURE;
  }

  D3D_FEATURE_LEVEL feature_level{};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  const D3D_FEATURE_LEVEL requested = D3D_FEATURE_LEVEL_11_0;
  const HRESULT create_result = D3D11CreateDevice(
      nullptr, D3D_DRIVER_TYPE_WARP, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      &requested, 1, D3D11_SDK_VERSION, &device, &feature_level, &context);
  if (FAILED(create_result)) {
    std::cerr << "D3D11 WARP device could not be created\n";
    return EXIT_FAILURE;
  }

  // 516px crosses the production 512px core boundary and exercises stitching
  // of a full tile with a narrow edge tile.
  constexpr std::uint32_t width = 516;
  constexpr std::uint32_t height = 16;
  std::vector<std::uint32_t> pixels(width * height);
  for (std::uint32_t y = 0; y < height; ++y) {
    for (std::uint32_t x = 0; x < width; ++x) {
      const std::uint8_t red = static_cast<std::uint8_t>(32U + x * 8U);
      const std::uint8_t green = static_cast<std::uint8_t>(48U + y * 7U);
      const std::uint8_t blue = static_cast<std::uint8_t>(64U + (x + y) * 3U);
      pixels[y * width + x] = 0xFF000000U | (static_cast<std::uint32_t>(red) << 16U) |
                              (static_cast<std::uint32_t>(green) << 8U) | blue;
    }
  }
  D3D11_TEXTURE2D_DESC source_description{};
  source_description.Width = width;
  source_description.Height = height;
  source_description.MipLevels = 1;
  source_description.ArraySize = 1;
  source_description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  source_description.SampleDesc.Count = 1;
  source_description.Usage = D3D11_USAGE_DEFAULT;
  source_description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  D3D11_SUBRESOURCE_DATA source_data{};
  source_data.pSysMem = pixels.data();
  source_data.SysMemPitch = width * sizeof(std::uint32_t);
  ComPtr<ID3D11Texture2D> source;
  if (FAILED(device->CreateTexture2D(&source_description, &source_data, &source))) {
    std::cerr << "Source texture could not be created\n";
    return EXIT_FAILURE;
  }

  std::string error;
  ComPtr<ID3D11ShaderResourceView> source_view;
  if (FAILED(device->CreateShaderResourceView(source.Get(), nullptr, &source_view))) {
    std::cerr << "Source view could not be created\n";
    return EXIT_FAILURE;
  }
  anime4k::renderer::AnimeJanaiPipeline animejanai(device.Get(), context.Get());
  anime4k::renderer::PipelineOutput animejanai_output;
  if (!animejanai.execute(
          source.Get(), source_view.Get(), width, height, animejanai_output, error)) {
    std::cerr << "AnimeJaNai execution failed: " << error << '\n';
    return EXIT_FAILURE;
  }
  if (animejanai_output.width != width * 2 || animejanai_output.height != height * 2 ||
      animejanai_output.texture == nullptr || animejanai_output.view == nullptr ||
      !texture_has_rgb_data(
          device.Get(), context.Get(), animejanai_output.texture.Get(), 0, animejanai_output.width)) {
    std::cerr << "AnimeJaNai returned an invalid x2 RGB output\n";
    return EXIT_FAILURE;
  }

  // A device-side shader creation failure used to leave a live aji context and
  // one shader behind. The next execute() then treated that state as initialized
  // and rendered with null bindings. Recreate that partial state deterministically
  // and verify that the same pipeline instance rolls back and retries cleanly.
  anime4k::renderer::AnimeJanaiPipelineTestAccess::simulate_partial_initialization(animejanai);
  if (anime4k::renderer::AnimeJanaiPipelineTestAccess::initialization_complete(animejanai)) {
    std::cerr << "AnimeJaNai partial-initialization test setup failed\n";
    return EXIT_FAILURE;
  }
  anime4k::renderer::PipelineOutput retried_output;
  if (!animejanai.execute(source.Get(), source_view.Get(), width, height, retried_output, error)) {
    std::cerr << "AnimeJaNai rollback retry failed: " << error << '\n';
    return EXIT_FAILURE;
  }
  if (!anime4k::renderer::AnimeJanaiPipelineTestAccess::initialization_complete(animejanai)
      || retried_output.width != width * 2 || retried_output.height != height * 2
      || retried_output.texture == nullptr || retried_output.view == nullptr
      || !texture_has_rgb_data(
          device.Get(), context.Get(), retried_output.texture.Get(), 0, retried_output.width)) {
    std::cerr << "AnimeJaNai did not recover completely from partial initialization\n";
    return EXIT_FAILURE;
  }
  std::cout << "Native GPU-resident AnimeJaNai pipeline executed successfully\n";
  return EXIT_SUCCESS;
}
