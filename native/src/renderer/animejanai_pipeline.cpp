#include "animejanai_pipeline.hpp"

#include "anime4k/win32_util.hpp"
#include "aji.h"

#include <shaders/FullscreenVS.hpp>
#include <shaders/PresentPS.hpp>

#include <winrt/base.h>

#include <algorithm>
#include <filesystem>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace anime4k::renderer {
namespace {

using Microsoft::WRL::ComPtr;

std::string hresult_message(HRESULT result) {
  return win32::wide_to_utf8(winrt::hresult_error(result).message().c_str());
}

std::filesystem::path executable_directory() {
  std::wstring buffer(32768, L'\0');
  const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  if (length == 0 || length >= buffer.size()) return {};
  buffer.resize(length);
  return std::filesystem::path(buffer).parent_path();
}

bool complete_runtime(const std::filesystem::path& directory) {
  std::error_code error;
  for (const auto& relative : {
           std::filesystem::path(L"AnimeJaNai.conf"),
           std::filesystem::path(L"runtime/aji.dll"),
           std::filesystem::path(L"runtime/aji_dml.dll"),
           std::filesystem::path(L"runtime/DirectML.dll"),
           std::filesystem::path(L"runtime/onnxruntime.dll"),
           std::filesystem::path(L"models/2x_AnimeJaNai_HD_V3.1_Performance_SPANF3_b5f48_unshuffle_fp16.onnx")}) {
    if (!std::filesystem::is_regular_file(directory / relative, error) || error) return false;
  }
  return true;
}

void collect_aji_log(void* opaque, int, const char* message) {
  if (opaque == nullptr || message == nullptr) return;
  auto& log = *static_cast<std::string*>(opaque);
  if (!log.empty()) log += "; ";
  log += message;
}

template <typename T>
bool load_function(HMODULE module, const char* name, T& target) {
  target = reinterpret_cast<T>(GetProcAddress(module, name));
  return target != nullptr;
}

}  // namespace

struct AnimeJanaiPipeline::Api {
  decltype(&aji_create) create{};
  decltype(&aji_configure) configure{};
  decltype(&aji_infer) infer{};
  decltype(&aji_flush) flush{};
  decltype(&aji_wait) wait{};
  decltype(&aji_last_error) last_error{};
  decltype(&aji_destroy) destroy{};
};

AnimeJanaiPipeline::AnimeJanaiPipeline(ID3D11Device* device, ID3D11DeviceContext* context)
    : device_(device), context_(context) {}

AnimeJanaiPipeline::~AnimeJanaiPipeline() {
  destroy_context();
}

std::filesystem::path AnimeJanaiPipeline::find_runtime_directory() {
  std::vector<std::filesystem::path> candidates;
  const auto executable = executable_directory();
  if (!executable.empty()) {
    candidates.emplace_back(executable / L"models" / L"animejanai");
    auto ancestor = executable;
    for (int depth = 0; depth < 7 && !ancestor.empty(); ++depth) {
      candidates.emplace_back(ancestor / L"native" / L"third_party" / L"animejanai");
      ancestor = ancestor.parent_path();
    }
  }
  std::error_code current_error;
  const auto current = std::filesystem::current_path(current_error);
  if (!current_error) {
    candidates.emplace_back(current / L"models" / L"animejanai");
    candidates.emplace_back(current / L"native" / L"third_party" / L"animejanai");
  }
  for (const auto& candidate : candidates) {
    if (!complete_runtime(candidate)) continue;
    std::error_code error;
    const auto canonical = std::filesystem::weakly_canonical(candidate, error);
    if (!error) return canonical;
  }
  return {};
}

bool AnimeJanaiPipeline::initialize(std::string& error) {
  const bool complete = module_ != nullptr && api_ != nullptr && aji_ != nullptr
      && vertex_shader_ != nullptr && copy_shader_ != nullptr && sampler_ != nullptr;
  if (complete) return true;
  // Never reuse a partially initialized runtime. This can happen after a
  // device-side shader creation failure and must be rolled back before retrying.
  if (module_ != nullptr || api_ != nullptr || aji_ != nullptr
      || vertex_shader_ != nullptr || copy_shader_ != nullptr || sampler_ != nullptr) {
    destroy_context();
  }
  const auto directory = find_runtime_directory();
  if (directory.empty()) {
    error = "AnimeJaNai DirectML runtime is missing from models/animejanai";
    return false;
  }

  const auto module_path = directory / L"runtime" / L"aji.dll";
  HMODULE module = LoadLibraryExW(
      module_path.c_str(),
      nullptr,
      LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
  if (module == nullptr) {
    error = "Could not load AnimeJaNai DirectML runtime: " + win32::last_error_message(GetLastError());
    return false;
  }
  auto api = std::make_unique<Api>();
  if (!load_function(module, "aji_create", api->create) ||
      !load_function(module, "aji_configure", api->configure) ||
      !load_function(module, "aji_infer", api->infer) ||
      !load_function(module, "aji_flush", api->flush) ||
      !load_function(module, "aji_wait", api->wait) ||
      !load_function(module, "aji_last_error", api->last_error) ||
      !load_function(module, "aji_destroy", api->destroy)) {
    error = "AnimeJaNai DirectML runtime exposes an incompatible aji ABI";
    FreeLibrary(module);
    return false;
  }

  const std::string config = win32::wide_to_utf8((directory / L"AnimeJaNai.conf").wstring());
  const std::string models = win32::wide_to_utf8((directory / L"models").wstring());
  aji_create_params params{};
  // mpv-AnimeJaNai 3.5.0 ships the stable aji ABI revision 7 even though
  // the development header already advertises the additive revision 8.
  params.api_version = 7;
  params.conf_path = config.c_str();
  params.model_dir = models.c_str();
  params.slot = 1;
  params.d3d11_device = device_.Get();
  std::string initialization_log;
  params.log = collect_aji_log;
  params.log_opaque = &initialization_log;
  aji_ctx* context = api->create(&params);
  if (context == nullptr) {
    error = "AnimeJaNai DirectML context could not be created" +
        (initialization_log.empty() ? std::string() : ": " + initialization_log);
    FreeLibrary(module);
    return false;
  }
  if (!create_shaders(error)) {
    api->destroy(&context);
    FreeLibrary(module);
    return false;
  }

  // Commit only after every runtime and D3D resource exists. No failure below
  // this point may expose a half-initialized pipeline to the next execute().
  module_ = module;
  aji_ = context;
  api_ = api.release();
  return true;
}

bool AnimeJanaiPipeline::create_shaders(std::string& error) {
  if (vertex_shader_ != nullptr && copy_shader_ != nullptr && sampler_ != nullptr) return true;

  // Shader setup is transactional as well: a failed pixel shader or sampler
  // must not leave a vertex shader that makes a retry look initialized.
  ComPtr<ID3D11VertexShader> vertex_shader;
  ComPtr<ID3D11PixelShader> copy_shader;
  ComPtr<ID3D11SamplerState> sampler;
  HRESULT result = device_->CreateVertexShader(kFullscreenVS, kFullscreenVSSize, nullptr, &vertex_shader);
  if (SUCCEEDED(result)) result = device_->CreatePixelShader(kPresentPS, kPresentPSSize, nullptr, &copy_shader);
  if (FAILED(result)) {
    error = "Could not create AnimeJaNai color conversion shaders: " + hresult_message(result);
    return false;
  }
  D3D11_SAMPLER_DESC description{};
  description.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
  description.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
  description.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
  description.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  description.MaxLOD = D3D11_FLOAT32_MAX;
  result = device_->CreateSamplerState(&description, &sampler);
  if (FAILED(result)) {
    error = "Could not create AnimeJaNai color conversion sampler: " + hresult_message(result);
    return false;
  }
  vertex_shader_ = std::move(vertex_shader);
  copy_shader_ = std::move(copy_shader);
  sampler_ = std::move(sampler);
  return true;
}

bool AnimeJanaiPipeline::ensure_configuration(
    std::uint32_t source_width,
    std::uint32_t source_height,
    std::string& error) {
  const auto input_width = (source_width + 1U) & ~1U;
  const auto input_height = (source_height + 1U) & ~1U;
  if (input_width_ == input_width && input_height_ == input_height && input_texture_ != nullptr) return true;

  int output_width = 0;
  int output_height = 0;
  const int configured = api_->configure(
      aji_,
      static_cast<int>(input_width),
      static_cast<int>(input_height),
      60.0,
      &output_width,
      &output_height);
  if (configured <= 0 || output_width <= 0 || output_height <= 0) {
    const char* detail = api_->last_error(aji_);
    error = std::string("AnimeJaNai configuration failed") +
        (detail != nullptr && *detail != '\0' ? ": " + std::string(detail) : "");
    return false;
  }
  return create_frame_resources(
      input_width,
      input_height,
      static_cast<std::uint32_t>(output_width),
      static_cast<std::uint32_t>(output_height),
      error);
}

bool AnimeJanaiPipeline::create_frame_resources(
    std::uint32_t input_width,
    std::uint32_t input_height,
    std::uint32_t output_width,
    std::uint32_t output_height,
    std::string& error) {
  clear_resources();
  D3D11_TEXTURE2D_DESC description{};
  description.Width = input_width;
  description.Height = input_height;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_R10G10B10A2_UNORM;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
  description.MiscFlags = D3D11_RESOURCE_MISC_SHARED | D3D11_RESOURCE_MISC_SHARED_NTHANDLE;
  HRESULT result = device_->CreateTexture2D(&description, nullptr, &input_texture_);
  if (SUCCEEDED(result)) result = device_->CreateRenderTargetView(input_texture_.Get(), nullptr, &input_target_);

  description.Width = output_width;
  description.Height = output_height;
  description.Format = DXGI_FORMAT_R10G10B10A2_UNORM;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  result = SUCCEEDED(result) ? device_->CreateTexture2D(&description, nullptr, &output_texture_) : result;
  if (SUCCEEDED(result)) result = device_->CreateShaderResourceView(output_texture_.Get(), nullptr, &output_view_);
  if (FAILED(result)) {
    clear_resources();
    error = "Could not create GPU-resident AnimeJaNai frame resources: " + hresult_message(result);
    return false;
  }
  input_width_ = input_width;
  input_height_ = input_height;
  output_width_ = output_width;
  output_height_ = output_height;
  return true;
}

void AnimeJanaiPipeline::render_input(ID3D11ShaderResourceView* source_view) {
  D3D11_VIEWPORT viewport{};
  viewport.Width = static_cast<float>(input_width_);
  viewport.Height = static_cast<float>(input_height_);
  viewport.MaxDepth = 1.0F;
  context_->OMSetRenderTargets(1, input_target_.GetAddressOf(), nullptr);
  context_->RSSetViewports(1, &viewport);
  context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  context_->VSSetShader(vertex_shader_.Get(), nullptr, 0);
  context_->PSSetShader(copy_shader_.Get(), nullptr, 0);
  context_->PSSetSamplers(0, 1, sampler_.GetAddressOf());
  context_->PSSetShaderResources(0, 1, &source_view);
  context_->Draw(3, 0);
  ID3D11ShaderResourceView* null_view = nullptr;
  context_->PSSetShaderResources(0, 1, &null_view);
  ID3D11RenderTargetView* null_target = nullptr;
  context_->OMSetRenderTargets(1, &null_target, nullptr);
}

bool AnimeJanaiPipeline::execute(
    ID3D11Texture2D* source_texture,
    ID3D11ShaderResourceView* source_view,
    std::uint32_t source_width,
    std::uint32_t source_height,
    PipelineOutput& output,
    std::string& error) {
  output = {};
  error.clear();
  if (source_texture == nullptr || source_view == nullptr || source_width == 0 || source_height == 0) {
    error = "AnimeJaNai received an empty capture texture";
    return false;
  }
  if (!initialize(error) || !ensure_configuration(source_width, source_height, error)) return false;

  render_input(source_view);
  aji_frame input{};
  input.width = static_cast<int>(input_width_);
  input.height = static_cast<int>(input_height_);
  input.format = AJI_FMT_RGB10A2;
  input.matrix = AJI_MATRIX_BT709;
  input.range = AJI_RANGE_FULL;
  input.siting = AJI_SITING_LEFT;
  input.plane[0] = input_texture_.Get();
  aji_frame result = input;
  result.width = static_cast<int>(output_width_);
  result.height = static_cast<int>(output_height_);
  result.format = AJI_FMT_RGB10A2;
  result.range = AJI_RANGE_FULL;
  result.plane[0] = output_texture_.Get();

  int status = api_->infer(aji_, &input, &result, nullptr);
  if (status == AJI_OK) status = api_->wait(aji_, api_->flush(aji_, nullptr));
  if (status != AJI_OK) {
    const char* detail = api_->last_error(aji_);
    error = std::string("AnimeJaNai DirectML inference failed") +
        (detail != nullptr && *detail != '\0' ? ": " + std::string(detail) : "");
    return false;
  }
  output.texture = output_texture_;
  output.view = output_view_;
  output.width = output_width_;
  output.height = output_height_;
  return true;
}

void AnimeJanaiPipeline::clear_resources() {
  output_view_.Reset();
  output_texture_.Reset();
  input_target_.Reset();
  input_texture_.Reset();
  input_width_ = 0;
  input_height_ = 0;
  output_width_ = 0;
  output_height_ = 0;
}

void AnimeJanaiPipeline::destroy_context() noexcept {
  clear_resources();
  if (aji_ != nullptr && api_ != nullptr && api_->destroy != nullptr) api_->destroy(&aji_);
  aji_ = nullptr;
  delete api_;
  api_ = nullptr;
  if (module_ != nullptr) FreeLibrary(module_);
  module_ = nullptr;
  sampler_.Reset();
  copy_shader_.Reset();
  vertex_shader_.Reset();
}

}  // namespace anime4k::renderer
