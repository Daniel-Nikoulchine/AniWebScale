#include "frame_generation_pipeline.hpp"

#include "anime4k/win32_util.hpp"

#include <shaders/FrameInterpolationPS.hpp>

#include <winrt/base.h>

#include <algorithm>
#include <array>
#include <utility>

namespace anime4k::renderer {
namespace {

struct alignas(16) InterpolationConstants {
  float factor{};
  float padding[3]{};
};

std::string hresult_message(HRESULT result) {
  return win32::wide_to_utf8(winrt::hresult_error(result).message().c_str());
}

bool history_matches(const D3D11_TEXTURE2D_DESC& left, const D3D11_TEXTURE2D_DESC& right) noexcept {
  return left.Width == right.Width && left.Height == right.Height && left.Format == right.Format
      && left.SampleDesc.Count == right.SampleDesc.Count
      && left.SampleDesc.Quality == right.SampleDesc.Quality;
}

}  // namespace

FrameGenerationPipeline::FrameGenerationPipeline(ID3D11Device* device, ID3D11DeviceContext* context)
    : device_(device), context_(context) {}

bool FrameGenerationPipeline::initialize(std::string& error) {
  if (interpolation_shader_ != nullptr && interpolation_constants_ != nullptr) return true;
  HRESULT result = device_->CreatePixelShader(
      kFrameInterpolationPS, kFrameInterpolationPSSize, nullptr, &interpolation_shader_);
  if (FAILED(result)) {
    error = "Create frame-interpolation shader failed: " + hresult_message(result);
    return false;
  }

  D3D11_BUFFER_DESC description{};
  description.ByteWidth = sizeof(InterpolationConstants);
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
  result = device_->CreateBuffer(&description, nullptr, &interpolation_constants_);
  if (FAILED(result)) {
    interpolation_shader_.Reset();
    error = "Create frame-interpolation constants failed: " + hresult_message(result);
    return false;
  }
  return true;
}

bool FrameGenerationPipeline::ensure_history(
    const D3D11_TEXTURE2D_DESC& source_description,
    std::string& error) {
  if (previous_texture_ != nullptr && current_texture_ != nullptr
      && history_matches(history_description_, source_description)) return true;

  clear_resources();
  D3D11_TEXTURE2D_DESC description = source_description;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.SampleDesc.Count = 1;
  description.SampleDesc.Quality = 0;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  description.CPUAccessFlags = 0;
  description.MiscFlags = 0;

  HRESULT result = device_->CreateTexture2D(&description, nullptr, &previous_texture_);
  if (SUCCEEDED(result)) {
    result = device_->CreateShaderResourceView(previous_texture_.Get(), nullptr, &previous_view_);
  }
  if (SUCCEEDED(result)) result = device_->CreateTexture2D(&description, nullptr, &current_texture_);
  if (SUCCEEDED(result)) {
    result = device_->CreateShaderResourceView(current_texture_.Get(), nullptr, &current_view_);
  }
  if (FAILED(result)) {
    clear_resources();
    error = "Could not allocate frame-generation history: " + hresult_message(result);
    return false;
  }
  history_description_ = description;
  return true;
}

bool FrameGenerationPipeline::push_frame(
    ID3D11Texture2D* source,
    bool& has_intermediate,
    std::string& error) {
  has_intermediate = false;
  if (source == nullptr) {
    error = "Frame generation received an invalid source texture";
    return false;
  }
  if (!initialize(error)) return false;
  D3D11_TEXTURE2D_DESC description{};
  source->GetDesc(&description);
  const bool retained_history = history_ready_ && previous_texture_ != nullptr && current_texture_ != nullptr
      && history_matches(history_description_, description);
  if (!ensure_history(description, error)) return false;

  if (!retained_history) {
    context_->CopyResource(previous_texture_.Get(), source);
    context_->CopyResource(current_texture_.Get(), source);
    history_ready_ = true;
    pair_ready_ = false;
    return true;
  }

  std::swap(previous_texture_, current_texture_);
  std::swap(previous_view_, current_view_);
  context_->CopyResource(current_texture_.Get(), source);
  pair_ready_ = true;
  has_intermediate = true;
  return true;
}

bool FrameGenerationPipeline::bind_for_presentation(float factor, std::string& error) {
  if (!history_ready_ || previous_view_ == nullptr || current_view_ == nullptr || !initialize(error)) {
    if (error.empty()) error = "Frame-generation history is not ready";
    return false;
  }
  InterpolationConstants constants{};
  constants.factor = std::clamp(factor, 0.0F, 1.0F);
  context_->UpdateSubresource(interpolation_constants_.Get(), 0, nullptr, &constants, 0, 0);
  context_->PSSetShader(interpolation_shader_.Get(), nullptr, 0);
  context_->PSSetConstantBuffers(0, 1, interpolation_constants_.GetAddressOf());
  std::array<ID3D11ShaderResourceView*, 2> views{previous_view_.Get(), current_view_.Get()};
  context_->PSSetShaderResources(0, static_cast<UINT>(views.size()), views.data());
  return true;
}

void FrameGenerationPipeline::unbind() noexcept {
  if (context_ == nullptr) return;
  std::array<ID3D11ShaderResourceView*, 2> null_views{};
  context_->PSSetShaderResources(0, static_cast<UINT>(null_views.size()), null_views.data());
  ID3D11Buffer* null_buffer = nullptr;
  context_->PSSetConstantBuffers(0, 1, &null_buffer);
}

void FrameGenerationPipeline::clear_resources() noexcept {
  unbind();
  previous_view_.Reset();
  previous_texture_.Reset();
  current_view_.Reset();
  current_texture_.Reset();
  history_description_ = {};
  history_ready_ = false;
  pair_ready_ = false;
}

}  // namespace anime4k::renderer
