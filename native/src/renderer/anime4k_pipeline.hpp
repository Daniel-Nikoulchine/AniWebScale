#pragma once

#include <d3d11.h>
#include <wrl/client.h>

#include <cstdint>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

namespace anime4k::renderer {

struct PipelineOutput {
  Microsoft::WRL::ComPtr<ID3D11Texture2D> texture;
  Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> view;
  std::uint32_t width{};
  std::uint32_t height{};
};

class Anime4KPipeline {
 public:
  Anime4KPipeline(ID3D11Device* device, ID3D11DeviceContext* context);
  ~Anime4KPipeline();
  Anime4KPipeline(const Anime4KPipeline&) = delete;
  Anime4KPipeline& operator=(const Anime4KPipeline&) = delete;

  [[nodiscard]] bool execute(
      ID3D11Texture2D* source_texture,
      ID3D11ShaderResourceView* source_view,
      std::uint32_t source_width,
      std::uint32_t source_height,
      std::uint32_t target_width,
      std::uint32_t target_height,
      std::string_view mode,
      std::string_view quality,
      PipelineOutput& output,
      std::string& error);

  void clear_resources();

  [[nodiscard]] std::uint64_t execution_plan_build_count_for_testing() const noexcept;

 private:
  struct Resource;
  struct ExecutionPlan;
  using ResourcePtr = std::shared_ptr<Resource>;

  [[nodiscard]] bool initialize(std::string& error);
  [[nodiscard]] bool ensure_execution_plan(
      std::uint32_t source_width,
      std::uint32_t source_height,
      std::uint32_t target_width,
      std::uint32_t target_height,
      std::string_view mode,
      std::string_view quality,
      std::string& error);
  [[nodiscard]] ResourcePtr acquire_resource(
      std::uint32_t width,
      std::uint32_t height,
      const std::unordered_map<std::string, ResourcePtr>& live_resources,
      std::string& error);

  Microsoft::WRL::ComPtr<ID3D11Device> device_;
  Microsoft::WRL::ComPtr<ID3D11DeviceContext> context_;
  Microsoft::WRL::ComPtr<ID3D11SamplerState> sampler_;
  std::unordered_map<std::string, Microsoft::WRL::ComPtr<ID3D11ComputeShader>> shaders_;
  std::vector<ResourcePtr> texture_pool_;
  std::unique_ptr<ExecutionPlan> execution_plan_;
  std::uint64_t execution_plan_build_count_{};
};

}  // namespace anime4k::renderer
