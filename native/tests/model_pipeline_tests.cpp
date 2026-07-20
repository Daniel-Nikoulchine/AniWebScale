#include "anime4k/model_package.hpp"
#include "anime4k_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <wrl/client.h>

#include <array>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace {

using Microsoft::WRL::ComPtr;

int failures = 0;

void expect(bool condition, const std::string& message) {
  if (!condition) {
    std::cerr << "FAILED: " << message << '\n';
    ++failures;
  }
}

bool output_has_data(ID3D11Device* device, ID3D11DeviceContext* context, ID3D11Texture2D* texture) {
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
  bool nonzero = false;
  for (std::uint32_t row = 0; row < description.Height && !nonzero; ++row) {
    const auto* bytes = static_cast<const std::uint8_t*>(mapped.pData) + static_cast<std::size_t>(row) * mapped.RowPitch;
    for (std::uint32_t column = 0; column < description.Width * 8U; ++column) {
      if (bytes[column] != 0) {
        nonzero = true;
        break;
      }
    }
  }
  context->Unmap(staging.Get(), 0);
  return nonzero;
}

std::optional<std::uint64_t> output_fingerprint(
    ID3D11Device* device,
    ID3D11DeviceContext* context,
    ID3D11Texture2D* texture) {
  if (texture == nullptr) return std::nullopt;
  D3D11_TEXTURE2D_DESC description{};
  texture->GetDesc(&description);
  if (description.Format != DXGI_FORMAT_R16G16B16A16_FLOAT) return std::nullopt;
  description.Usage = D3D11_USAGE_STAGING;
  description.BindFlags = 0;
  description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  description.MiscFlags = 0;
  ComPtr<ID3D11Texture2D> staging;
  if (FAILED(device->CreateTexture2D(&description, nullptr, &staging))) return std::nullopt;
  context->CopyResource(staging.Get(), texture);
  D3D11_MAPPED_SUBRESOURCE mapped{};
  if (FAILED(context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return std::nullopt;
  std::uint64_t fingerprint = 1469598103934665603ULL;
  constexpr std::uint32_t bytes_per_pixel = 8;
  for (std::uint32_t row = 0; row < description.Height; ++row) {
    const auto* bytes = static_cast<const std::uint8_t*>(mapped.pData) + static_cast<std::size_t>(row) * mapped.RowPitch;
    for (std::uint32_t column = 0; column < description.Width * bytes_per_pixel; ++column) {
      fingerprint ^= bytes[column];
      fingerprint *= 1099511628211ULL;
    }
  }
  context->Unmap(staging.Get(), 0);
  return fingerprint;
}

}  // namespace

int main() {
  expect(anime4k::models::effects().size() == 16, "model package exposes Anime4K plus three external GLSL effects");
  expect(anime4k::models::presets().size() == 30, "model package exposes all 30 native upscale presets");

  D3D_FEATURE_LEVEL feature_level{};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  const D3D_FEATURE_LEVEL requested = D3D_FEATURE_LEVEL_11_0;
  const HRESULT create_result = D3D11CreateDevice(
      nullptr, D3D_DRIVER_TYPE_WARP, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      &requested, 1, D3D11_SDK_VERSION, &device, &feature_level, &context);
  expect(SUCCEEDED(create_result), "D3D11 WARP device is available");
  if (FAILED(create_result)) return EXIT_FAILURE;

  constexpr std::uint32_t source_width = 8;
  constexpr std::uint32_t source_height = 8;
  std::vector<std::uint32_t> pixels(source_width * source_height);
  for (std::uint32_t y = 0; y < source_height; ++y) {
    for (std::uint32_t x = 0; x < source_width; ++x) {
      const std::uint8_t red = static_cast<std::uint8_t>(32U + x * 24U);
      const std::uint8_t green = static_cast<std::uint8_t>(16U + y * 28U);
      const std::uint8_t blue = static_cast<std::uint8_t>(64U + (x + y) * 8U);
      pixels[y * source_width + x] = 0xFF000000U | (static_cast<std::uint32_t>(red) << 16U) |
                                     (static_cast<std::uint32_t>(green) << 8U) | blue;
    }
  }
  D3D11_TEXTURE2D_DESC source_description{};
  source_description.Width = source_width;
  source_description.Height = source_height;
  source_description.MipLevels = 1;
  source_description.ArraySize = 1;
  source_description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  source_description.SampleDesc.Count = 1;
  source_description.Usage = D3D11_USAGE_DEFAULT;
  source_description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  D3D11_SUBRESOURCE_DATA source_data{};
  source_data.pSysMem = pixels.data();
  source_data.SysMemPitch = source_width * sizeof(std::uint32_t);
  ComPtr<ID3D11Texture2D> source_texture;
  ComPtr<ID3D11ShaderResourceView> source_view;
  expect(SUCCEEDED(device->CreateTexture2D(&source_description, &source_data, &source_texture)), "source texture is created");
  expect(SUCCEEDED(device->CreateShaderResourceView(source_texture.Get(), nullptr, &source_view)), "source SRV is created");

  anime4k::renderer::Anime4KPipeline pipeline(device.Get(), context.Get());
  constexpr std::array<const char*, 10> modes{
      "A", "B", "C", "AA", "BB", "CA", "CNNX2",
      "ARTCNN", "ACNET", "ARNET"};
  constexpr std::array<const char*, 3> qualities{"M", "VL", "UL"};
  for (const char* mode : modes) {
    for (const char* quality : qualities) {
      expect(anime4k::models::find_preset(mode, quality) != nullptr, std::string("preset exists: ") + mode + '/' + quality);
      anime4k::renderer::PipelineOutput output;
      std::string error = "stale caller error";
      const bool executed = pipeline.execute(
          source_texture.Get(), source_view.Get(), source_width, source_height, 16, 16,
          mode, quality, output, error);
      expect(executed, std::string("compute graph executes: ") + mode + '/' + quality + (error.empty() ? "" : " (" + error + ')'));
      if (executed) {
        expect(error.empty(), std::string("successful execution clears stale errors: ") + mode + '/' + quality);
        expect(output.width == 16U && output.height == 16U,
            std::string("upscale result has the expected extent: ") + mode + '/' + quality);
        expect(output_has_data(device.Get(), context.Get(), output.texture.Get()), std::string("output is non-empty: ") + mode + '/' + quality);
      }
    }
  }

  const std::uint64_t builds_after_all_presets = pipeline.execution_plan_build_count_for_testing();
  expect(builds_after_all_presets == modes.size() * qualities.size(),
      "each distinct mode/quality key builds one execution plan");

  anime4k::renderer::PipelineOutput cached_output;
  std::string cached_error;
  const bool cached_executed = pipeline.execute(
      source_texture.Get(), source_view.Get(), source_width, source_height, 16, 16,
      "ARNET", "UL", cached_output, cached_error);
  expect(cached_executed, "an unchanged key executes through the cached plan");
  expect(pipeline.execution_plan_build_count_for_testing() == builds_after_all_presets,
      "an unchanged key does not rebuild the execution plan");
  const auto original_fingerprint = cached_executed
      ? output_fingerprint(device.Get(), context.Get(), cached_output.texture.Get())
      : std::nullopt;
  expect(original_fingerprint.has_value(), "cached output can be fingerprinted");

  std::vector<std::uint32_t> replacement_pixels = pixels;
  for (std::uint32_t& pixel : replacement_pixels) pixel = 0xFF000000U | ((~pixel) & 0x00FFFFFFU);
  D3D11_SUBRESOURCE_DATA replacement_data{};
  replacement_data.pSysMem = replacement_pixels.data();
  replacement_data.SysMemPitch = source_width * sizeof(std::uint32_t);
  ComPtr<ID3D11Texture2D> replacement_texture;
  ComPtr<ID3D11ShaderResourceView> replacement_view;
  expect(SUCCEEDED(device->CreateTexture2D(
      &source_description, &replacement_data, &replacement_texture)), "replacement source texture is created");
  expect(SUCCEEDED(device->CreateShaderResourceView(
      replacement_texture.Get(), nullptr, &replacement_view)), "replacement source SRV is created");

  anime4k::renderer::PipelineOutput rebound_output;
  std::string rebound_error;
  const bool rebound_executed = pipeline.execute(
      replacement_texture.Get(), replacement_view.Get(), source_width, source_height, 16, 16,
      "ARNET", "UL", rebound_output, rebound_error);
  expect(rebound_executed, "a cached plan accepts a replacement source texture and SRV");
  expect(pipeline.execution_plan_build_count_for_testing() == builds_after_all_presets,
      "source identity changes do not rebuild a dimension-compatible plan");
  const auto replacement_fingerprint = rebound_executed
      ? output_fingerprint(device.Get(), context.Get(), rebound_output.texture.Get())
      : std::nullopt;
  expect(replacement_fingerprint.has_value(), "rebound output can be fingerprinted");
  if (original_fingerprint.has_value() && replacement_fingerprint.has_value()) {
    expect(*original_fingerprint != *replacement_fingerprint,
        "the cached plan reads from the replacement source SRV");
  }

  const std::uint64_t builds_before_dimension_change = pipeline.execution_plan_build_count_for_testing();
  anime4k::renderer::PipelineOutput resized_target_output;
  std::string resized_target_error;
  const bool resized_target_executed = pipeline.execute(
      replacement_texture.Get(), replacement_view.Get(), source_width, source_height, 8, 8,
      "A", "M", resized_target_output, resized_target_error);
  expect(resized_target_executed, "a changed target extent builds and executes a new plan");
  expect(pipeline.execution_plan_build_count_for_testing() == builds_before_dimension_change + 1,
      "target dimensions invalidate the execution plan");
  if (resized_target_executed) {
    expect(resized_target_output.width == 8U && resized_target_output.height == 8U,
        "the rebuilt plan uses the changed target extent");
  }

  const std::uint64_t builds_before_clear = pipeline.execution_plan_build_count_for_testing();
  pipeline.clear_resources();
  anime4k::renderer::PipelineOutput cleared_output;
  std::string cleared_error;
  const bool cleared_executed = pipeline.execute(
      replacement_texture.Get(), replacement_view.Get(), source_width, source_height, 8, 8,
      "A", "M", cleared_output, cleared_error);
  expect(cleared_executed, "the pipeline executes after clear_resources");
  expect(pipeline.execution_plan_build_count_for_testing() == builds_before_clear + 1,
      "clear_resources invalidates the execution plan");

  if (failures != 0) {
    std::cerr << failures << " model pipeline test(s) failed\n";
    return EXIT_FAILURE;
  }
  std::cout << "All 30 native Anime4K/ArtCNN/ACNet/ARNet model graphs executed successfully\n";
  return EXIT_SUCCESS;
}
