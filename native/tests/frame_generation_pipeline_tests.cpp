#include "frame_generation_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <wrl/client.h>

#include <shaders/FullscreenVS.hpp>

#include <array>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

namespace {

using Microsoft::WRL::ComPtr;

int failures = 0;

void expect(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAILED: " << message << '\n';
    ++failures;
  }
}

ComPtr<ID3D11Texture2D> make_source(
    ID3D11Device* device,
    std::uint32_t width,
    std::uint32_t height,
    std::uint32_t color) {
  std::vector<std::uint32_t> pixels(static_cast<std::size_t>(width) * height, color);
  D3D11_TEXTURE2D_DESC description{};
  description.Width = width;
  description.Height = height;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  D3D11_SUBRESOURCE_DATA data{};
  data.pSysMem = pixels.data();
  data.SysMemPitch = width * sizeof(std::uint32_t);
  ComPtr<ID3D11Texture2D> texture;
  if (FAILED(device->CreateTexture2D(&description, &data, &texture))) return nullptr;
  return texture;
}

std::uint32_t render_factor(
    ID3D11Device* device,
    ID3D11DeviceContext* context,
    ID3D11VertexShader* vertex_shader,
    anime4k::renderer::FrameGenerationPipeline& pipeline,
    float factor,
    std::string& error) {
  constexpr std::uint32_t width = 8;
  constexpr std::uint32_t height = 8;
  D3D11_TEXTURE2D_DESC description{};
  description.Width = width;
  description.Height = height;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_RENDER_TARGET;
  ComPtr<ID3D11Texture2D> target;
  ComPtr<ID3D11RenderTargetView> target_view;
  HRESULT result = device->CreateTexture2D(&description, nullptr, &target);
  if (SUCCEEDED(result)) result = device->CreateRenderTargetView(target.Get(), nullptr, &target_view);
  if (FAILED(result)) return 0;

  description.Usage = D3D11_USAGE_STAGING;
  description.BindFlags = 0;
  description.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  ComPtr<ID3D11Texture2D> staging;
  if (FAILED(device->CreateTexture2D(&description, nullptr, &staging))) return 0;

  D3D11_VIEWPORT viewport{};
  viewport.Width = static_cast<float>(width);
  viewport.Height = static_cast<float>(height);
  viewport.MaxDepth = 1.0F;
  context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  context->VSSetShader(vertex_shader, nullptr, 0);
  context->RSSetViewports(1, &viewport);
  context->OMSetRenderTargets(1, target_view.GetAddressOf(), nullptr);
  if (!pipeline.bind_for_presentation(factor, error)) return 0;
  context->Draw(3, 0);
  pipeline.unbind();
  ID3D11RenderTargetView* null_target = nullptr;
  context->OMSetRenderTargets(1, &null_target, nullptr);
  context->CopyResource(staging.Get(), target.Get());
  D3D11_MAPPED_SUBRESOURCE mapped{};
  if (FAILED(context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return 0;
  const auto pixel = *static_cast<const std::uint32_t*>(mapped.pData);
  context->Unmap(staging.Get(), 0);
  return pixel;
}

}  // namespace

int main() {
  D3D_FEATURE_LEVEL selected{};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  const std::array<D3D_FEATURE_LEVEL, 1> levels{D3D_FEATURE_LEVEL_11_0};
  const HRESULT device_result = D3D11CreateDevice(
      nullptr, D3D_DRIVER_TYPE_WARP, nullptr, 0, levels.data(), static_cast<UINT>(levels.size()),
      D3D11_SDK_VERSION, &device, &selected, &context);
  expect(SUCCEEDED(device_result), "D3D11 WARP device is available");
  if (FAILED(device_result)) return EXIT_FAILURE;

  ComPtr<ID3D11VertexShader> vertex_shader;
  expect(SUCCEEDED(device->CreateVertexShader(
      kFullscreenVS, kFullscreenVSSize, nullptr, &vertex_shader)), "fullscreen vertex shader is created");
  if (vertex_shader == nullptr) return EXIT_FAILURE;
  D3D11_SAMPLER_DESC sampler_description{};
  sampler_description.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
  sampler_description.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.MaxLOD = D3D11_FLOAT32_MAX;
  ComPtr<ID3D11SamplerState> sampler;
  expect(SUCCEEDED(device->CreateSamplerState(&sampler_description, &sampler)), "linear clamp sampler is created");
  context->PSSetSamplers(0, 1, sampler.GetAddressOf());

  anime4k::renderer::FrameGenerationPipeline pipeline(device.Get(), context.Get());
  auto first = make_source(device.Get(), 8, 8, 0xFF404040U);
  auto second = make_source(device.Get(), 8, 8, 0xFF484848U);
  expect(first != nullptr && second != nullptr, "frame-generation source textures are created");
  std::string error;
  bool has_intermediate = true;
  expect(pipeline.push_frame(first.Get(), has_intermediate, error), "first history frame is accepted");
  expect(!has_intermediate && pipeline.has_history(), "first history frame seeds without an intermediate");
  expect(pipeline.push_frame(second.Get(), has_intermediate, error), "second history frame is accepted");
  expect(has_intermediate && pipeline.has_intermediate(), "second history frame exposes an intermediate");

  const auto previous = render_factor(device.Get(), context.Get(), vertex_shader.Get(), pipeline, 0.0F, error);
  const auto midpoint = render_factor(device.Get(), context.Get(), vertex_shader.Get(), pipeline, 0.5F, error);
  const auto current = render_factor(device.Get(), context.Get(), vertex_shader.Get(), pipeline, 1.0F, error);
  expect((previous & 0x00FFFFFFU) == 0x00404040U, "factor zero presents the previous frame");
  expect((current & 0x00FFFFFFU) == 0x00484848U, "factor one presents the current frame");
  const auto midpoint_channel = midpoint & 0xFFU;
  expect(midpoint_channel >= 0x43U && midpoint_channel <= 0x45U,
      "factor one-half produces the motion-aware midpoint for a coherent pair");

  auto resized = make_source(device.Get(), 4, 4, 0xFF606060U);
  has_intermediate = true;
  expect(pipeline.push_frame(resized.Get(), has_intermediate, error), "resized history frame is accepted");
  expect(!has_intermediate, "source resize resets interpolation history");
  pipeline.clear_resources();
  expect(!pipeline.has_history() && !pipeline.has_intermediate(), "resource cleanup clears all history state");

  if (!error.empty()) std::cerr << "Last D3D error: " << error << '\n';
  if (failures != 0) return EXIT_FAILURE;
  std::cout << "Native frame-generation pipeline tests passed\n";
  return EXIT_SUCCESS;
}
