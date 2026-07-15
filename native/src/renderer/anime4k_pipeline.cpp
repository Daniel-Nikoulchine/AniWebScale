#include "anime4k_pipeline.hpp"

#include "anime4k/model_package.hpp"
#include "anime4k/win32_util.hpp"

#include <winrt/base.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <optional>
#include <set>
#include <span>
#include <string_view>

namespace anime4k::renderer {
namespace {

using Microsoft::WRL::ComPtr;

constexpr std::size_t kMaximumInputs = 128;
constexpr std::uint32_t kMaximumTextureDimension = D3D11_REQ_TEXTURE2D_U_OR_V_DIMENSION;

struct alignas(16) PassConstants {
  std::uint32_t output_size[2];
  std::uint32_t reserved[2];
  std::uint32_t input_sizes[kMaximumInputs][4];
};

std::string hresult_message(HRESULT result) {
  return win32::wide_to_utf8(winrt::hresult_error(result).message().c_str());
}

std::optional<double> parse_number(std::string_view token) {
  std::string copy(token);
  char* end = nullptr;
  const double value = std::strtod(copy.c_str(), &end);
  if (end == copy.c_str() || *end != '\0' || !std::isfinite(value)) return std::nullopt;
  return value;
}

std::optional<double> evaluate_rpn(
    const char* const* tokens,
    std::uint32_t count,
    const std::unordered_map<std::string, std::pair<std::uint32_t, std::uint32_t>>& sizes,
    std::uint32_t target_width,
    std::uint32_t target_height) {
  std::vector<double> stack;
  stack.reserve(count);
  for (std::uint32_t index = 0; index < count; ++index) {
    const std::string_view token(tokens[index]);
    if (token == "*" || token == "/" || token == ">") {
      if (stack.size() < 2) return std::nullopt;
      const double right = stack.back();
      stack.pop_back();
      const double left = stack.back();
      stack.pop_back();
      if (token == "*") stack.push_back(left * right);
      else if (token == "/") {
        if (right == 0.0) return std::nullopt;
        stack.push_back(left / right);
      } else stack.push_back(left > right ? 1.0 : 0.0);
      continue;
    }
    if (const auto number = parse_number(token); number.has_value()) {
      stack.push_back(*number);
      continue;
    }
    const auto dot = token.rfind('.');
    if (dot == std::string_view::npos) return std::nullopt;
    const std::string name(token.substr(0, dot));
    const std::string_view component = token.substr(dot + 1);
    if (name == "OUTPUT") {
      if (component == "w") stack.push_back(static_cast<double>(target_width));
      else if (component == "h") stack.push_back(static_cast<double>(target_height));
      else return std::nullopt;
      continue;
    }
    const auto resource = sizes.find(name);
    if (resource == sizes.end()) return std::nullopt;
    if (component == "w") stack.push_back(static_cast<double>(resource->second.first));
    else if (component == "h") stack.push_back(static_cast<double>(resource->second.second));
    else return std::nullopt;
  }
  if (stack.size() != 1 || !std::isfinite(stack.back())) return std::nullopt;
  return stack.back();
}

}  // namespace

struct Anime4KPipeline::Resource {
  ComPtr<ID3D11Texture2D> texture;
  ComPtr<ID3D11ShaderResourceView> view;
  ComPtr<ID3D11UnorderedAccessView> unordered_view;
  std::uint32_t width{};
  std::uint32_t height{};
};

struct Anime4KPipeline::ExecutionPlan {
  struct ResolvedPass {
    ComPtr<ID3D11ComputeShader> shader;
    std::vector<ResourcePtr> inputs;
    ResourcePtr destination;
    PassConstants constants{};
    std::uint32_t dispatch_x{};
    std::uint32_t dispatch_y{};
  };

  std::uint32_t source_width{};
  std::uint32_t source_height{};
  std::uint32_t target_width{};
  std::uint32_t target_height{};
  std::string mode;
  std::string quality;
  ResourcePtr source;
  ResourcePtr output;
  std::vector<ResolvedPass> passes;

  [[nodiscard]] bool matches(
      std::uint32_t candidate_source_width,
      std::uint32_t candidate_source_height,
      std::uint32_t candidate_target_width,
      std::uint32_t candidate_target_height,
      std::string_view candidate_mode,
      std::string_view candidate_quality) const noexcept {
    return source_width == candidate_source_width
        && source_height == candidate_source_height
        && target_width == candidate_target_width
        && target_height == candidate_target_height
        && mode == candidate_mode
        && quality == candidate_quality;
  }
};

Anime4KPipeline::Anime4KPipeline(ID3D11Device* device, ID3D11DeviceContext* context)
    : device_(device), context_(context) {}

Anime4KPipeline::~Anime4KPipeline() = default;

bool Anime4KPipeline::initialize(std::string& error) {
  if (sampler_ != nullptr && constant_buffer_ != nullptr) return true;
  D3D11_SAMPLER_DESC sampler_description{};
  sampler_description.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
  sampler_description.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  sampler_description.MaxLOD = D3D11_FLOAT32_MAX;
  HRESULT result = device_->CreateSamplerState(&sampler_description, &sampler_);
  if (FAILED(result)) {
    error = "CreateSamplerState for Anime4K compute failed: " + hresult_message(result);
    return false;
  }
  D3D11_BUFFER_DESC buffer_description{};
  buffer_description.ByteWidth = sizeof(PassConstants);
  buffer_description.Usage = D3D11_USAGE_DEFAULT;
  buffer_description.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
  result = device_->CreateBuffer(&buffer_description, nullptr, &constant_buffer_);
  if (FAILED(result)) {
    error = "CreateBuffer for Anime4K constants failed: " + hresult_message(result);
    return false;
  }
  return true;
}

Anime4KPipeline::ResourcePtr Anime4KPipeline::acquire_resource(
    std::uint32_t width,
    std::uint32_t height,
    const std::unordered_map<std::string, ResourcePtr>& live_resources,
    std::string& error) {
  std::set<ID3D11Texture2D*> forbidden;
  for (const auto& [name, resource] : live_resources) {
    (void)name;
    if (resource != nullptr) forbidden.insert(resource->texture.Get());
  }
  for (const auto& resource : texture_pool_) {
    if (resource->width == width && resource->height == height && !forbidden.contains(resource->texture.Get())) return resource;
  }

  auto resource = std::make_shared<Resource>();
  resource->width = width;
  resource->height = height;
  D3D11_TEXTURE2D_DESC description{};
  description.Width = width;
  description.Height = height;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_R16G16B16A16_FLOAT;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE | D3D11_BIND_UNORDERED_ACCESS;
  HRESULT result = device_->CreateTexture2D(&description, nullptr, &resource->texture);
  if (SUCCEEDED(result)) result = device_->CreateShaderResourceView(resource->texture.Get(), nullptr, &resource->view);
  if (SUCCEEDED(result)) result = device_->CreateUnorderedAccessView(resource->texture.Get(), nullptr, &resource->unordered_view);
  if (FAILED(result)) {
    error = "could not allocate Anime4K tensor " + std::to_string(width) + "x" + std::to_string(height) + ": " + hresult_message(result);
    return nullptr;
  }
  texture_pool_.push_back(resource);
  return resource;
}

bool Anime4KPipeline::ensure_execution_plan(
    std::uint32_t source_width,
    std::uint32_t source_height,
    std::uint32_t target_width,
    std::uint32_t target_height,
    std::string_view mode,
    std::string_view quality,
    std::string& error) {
  if (execution_plan_ != nullptr && execution_plan_->matches(
          source_width, source_height, target_width, target_height, mode, quality)) {
    return true;
  }

  const models::Preset* preset = models::find_preset(mode, quality);
  if (preset == nullptr) {
    error = "generated Anime4K preset was not found";
    return false;
  }

  auto candidate = std::make_unique<ExecutionPlan>();
  candidate->source_width = source_width;
  candidate->source_height = source_height;
  candidate->target_width = target_width;
  candidate->target_height = target_height;
  candidate->mode = mode;
  candidate->quality = quality;
  candidate->source = std::make_shared<Resource>();
  candidate->source->width = source_width;
  candidate->source->height = source_height;
  ResourcePtr current = candidate->source;

  for (std::uint32_t effect_index = 0; effect_index < preset->effect_count; ++effect_index) {
    const models::Effect* effect = models::find_effect(preset->effect_ids[effect_index]);
    if (effect == nullptr || effect->pass_count == 0) {
      error = "generated Anime4K effect is missing: " + std::string(preset->effect_ids[effect_index]);
      return false;
    }

    std::unordered_map<std::string, ResourcePtr> resources;
    resources.emplace("MAIN", current);
    resources.emplace("HOOKED", current);
    resources.emplace("LUMA", current);
    std::unordered_map<std::string, std::pair<std::uint32_t, std::uint32_t>> sizes;
    sizes.emplace("MAIN", std::pair(current->width, current->height));
    sizes.emplace("HOOKED", std::pair(current->width, current->height));
    sizes.emplace("LUMA", std::pair(current->width, current->height));

    const models::Pass& first_pass = effect->passes[0];
    if (first_pass.when_rpn_count > 0) {
      const auto condition = evaluate_rpn(
          first_pass.when_rpn, first_pass.when_rpn_count, sizes, target_width, target_height);
      if (!condition.has_value()) {
        error = "could not evaluate Anime4K WHEN expression for " + std::string(effect->id);
        return false;
      }
      if (*condition == 0.0) continue;
    }

    const std::string result_name = std::string_view(effect->family) == "clamp" ? "HOOKED" : "MAIN";
    for (std::uint32_t pass_index = 0; pass_index < effect->pass_count; ++pass_index) {
      const models::Pass& pass = effect->passes[pass_index];
      if (pass.binding_count == 0 || pass.binding_count > kMaximumInputs) {
        error = "Anime4K pass has an invalid binding count: " + std::string(pass.id);
        return false;
      }
      const auto width_value = evaluate_rpn(
          pass.width_rpn, pass.width_rpn_count, sizes, target_width, target_height);
      const auto height_value = evaluate_rpn(
          pass.height_rpn, pass.height_rpn_count, sizes, target_width, target_height);
      if (!width_value.has_value() || !height_value.has_value()) {
        error = "could not evaluate Anime4K output dimensions for " + std::string(pass.id);
        return false;
      }
      const auto output_width_ll = std::llround(*width_value);
      const auto output_height_ll = std::llround(*height_value);
      if (output_width_ll <= 0 || output_height_ll <= 0
          || output_width_ll > kMaximumTextureDimension || output_height_ll > kMaximumTextureDimension) {
        error = "Anime4K pass requested an unsupported tensor size: " + std::string(pass.id);
        return false;
      }
      const auto output_width = static_cast<std::uint32_t>(output_width_ll);
      const auto output_height = static_cast<std::uint32_t>(output_height_ll);
      auto destination = acquire_resource(output_width, output_height, resources, error);
      if (destination == nullptr) return false;

      ComPtr<ID3D11ComputeShader>& shader = shaders_[pass.id];
      if (shader == nullptr) {
        const HRESULT result = device_->CreateComputeShader(pass.bytecode, pass.bytecode_size, nullptr, &shader);
        if (FAILED(result)) {
          error = "CreateComputeShader failed for " + std::string(pass.id) + ": " + hresult_message(result);
          return false;
        }
      }

      ExecutionPlan::ResolvedPass resolved;
      resolved.shader = shader;
      resolved.destination = destination;
      resolved.constants.output_size[0] = output_width;
      resolved.constants.output_size[1] = output_height;
      for (std::uint32_t binding_index = 0; binding_index < pass.binding_count; ++binding_index) {
        const models::Binding& binding = pass.bindings[binding_index];
        if (binding.srv_slot >= kMaximumInputs) {
          error = "Anime4K pass uses an unsupported SRV slot: " + std::string(pass.id);
          return false;
        }
        const auto resource = resources.find(binding.logical_resource);
        if (resource == resources.end() || resource->second == nullptr || resource->second->view == nullptr) {
          // The dynamic source SRV is attached immediately before execution;
          // every intermediate resource must already have a view while planning.
          if (resource == resources.end() || resource->second != candidate->source) {
            error = "Anime4K logical input is unavailable: " + std::string(binding.logical_resource);
            return false;
          }
        }
        if (resolved.inputs.size() <= binding.srv_slot) resolved.inputs.resize(binding.srv_slot + 1);
        resolved.inputs[binding.srv_slot] = resource->second;
        resolved.constants.input_sizes[binding.srv_slot][0] = resource->second->width;
        resolved.constants.input_sizes[binding.srv_slot][1] = resource->second->height;
      }
      resolved.dispatch_x = (output_width + 7U) / 8U;
      resolved.dispatch_y = (output_height + 7U) / 8U;
      candidate->passes.push_back(std::move(resolved));

      resources[pass.output_resource] = destination;
      sizes[pass.output_resource] = {output_width, output_height};

      // mpv luma-only graphs keep using LUMA.w/h as their dimension anchor
      // after the first convolution no longer binds the source texture.
      std::set<std::string, std::less<>> future_resources{result_name, "LUMA"};
      for (std::uint32_t future_index = pass_index + 1; future_index < effect->pass_count; ++future_index) {
        const models::Pass& future = effect->passes[future_index];
        for (std::uint32_t binding_index = 0; binding_index < future.binding_count; ++binding_index) {
          future_resources.emplace(future.bindings[binding_index].logical_resource);
        }
      }
      for (auto iterator = resources.begin(); iterator != resources.end();) {
        if (!future_resources.contains(iterator->first)) iterator = resources.erase(iterator);
        else ++iterator;
      }
      for (auto iterator = sizes.begin(); iterator != sizes.end();) {
        if (!future_resources.contains(iterator->first)) iterator = sizes.erase(iterator);
        else ++iterator;
      }
    }

    const auto result = resources.find(result_name);
    if (result == resources.end() || result->second == nullptr) {
      error = "Anime4K effect did not produce its declared result: " + std::string(effect->id);
      return false;
    }
    current = result->second;
  }

  candidate->output = current;
  execution_plan_ = std::move(candidate);
  ++execution_plan_build_count_;
  return true;
}

bool Anime4KPipeline::execute(
    ID3D11Texture2D* source_texture,
    ID3D11ShaderResourceView* source_view,
    std::uint32_t source_width,
    std::uint32_t source_height,
    std::uint32_t target_width,
    std::uint32_t target_height,
    std::string_view mode,
    std::string_view quality,
    PipelineOutput& output,
    std::string& error) {
  output = {};
  error.clear();
  if (source_texture == nullptr || source_view == nullptr || source_width == 0 || source_height == 0 || target_width == 0 || target_height == 0) {
    error = "Anime4K pipeline received an invalid source or target";
    return false;
  }
  if (!initialize(error)) return false;
  if (!ensure_execution_plan(
          source_width, source_height, target_width, target_height, mode, quality, error)) return false;

  ExecutionPlan& plan = *execution_plan_;
  if (plan.source->texture.Get() != source_texture) plan.source->texture = source_texture;
  if (plan.source->view.Get() != source_view) plan.source->view = source_view;
  std::array<ID3D11ShaderResourceView*, kMaximumInputs> input_views{};
  std::array<ID3D11ShaderResourceView*, kMaximumInputs> null_views{};
  for (const ExecutionPlan::ResolvedPass& pass : plan.passes) {
    for (std::size_t index = 0; index < pass.inputs.size(); ++index) {
      input_views[index] = pass.inputs[index] == nullptr ? nullptr : pass.inputs[index]->view.Get();
    }

    context_->UpdateSubresource(constant_buffer_.Get(), 0, nullptr, &pass.constants, 0, 0);
    context_->CSSetShader(pass.shader.Get(), nullptr, 0);
    context_->CSSetConstantBuffers(0, 1, constant_buffer_.GetAddressOf());
    context_->CSSetSamplers(0, 1, sampler_.GetAddressOf());
    context_->CSSetShaderResources(0, static_cast<UINT>(pass.inputs.size()), input_views.data());
    context_->CSSetUnorderedAccessViews(0, 1, pass.destination->unordered_view.GetAddressOf(), nullptr);
    context_->Dispatch(pass.dispatch_x, pass.dispatch_y, 1);

    ID3D11UnorderedAccessView* null_uav = nullptr;
    context_->CSSetUnorderedAccessViews(0, 1, &null_uav, nullptr);
    context_->CSSetShaderResources(0, static_cast<UINT>(pass.inputs.size()), null_views.data());
  }

  context_->CSSetShader(nullptr, nullptr, 0);
  output.texture = plan.output->texture;
  output.view = plan.output->view;
  output.width = plan.output->width;
  output.height = plan.output->height;
  return true;
}

std::uint64_t Anime4KPipeline::execution_plan_build_count_for_testing() const noexcept {
  return execution_plan_build_count_;
}

void Anime4KPipeline::clear_resources() {
  if (context_ != nullptr) {
    context_->CSSetShader(nullptr, nullptr, 0);
    ID3D11UnorderedAccessView* null_uav = nullptr;
    context_->CSSetUnorderedAccessViews(0, 1, &null_uav, nullptr);
    std::array<ID3D11ShaderResourceView*, kMaximumInputs> null_views{};
    context_->CSSetShaderResources(0, static_cast<UINT>(null_views.size()), null_views.data());
  }
  execution_plan_.reset();
  texture_pool_.clear();
}

}  // namespace anime4k::renderer
