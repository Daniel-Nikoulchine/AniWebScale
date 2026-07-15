#pragma once

#include "anime4k_pipeline.hpp"

#include <Windows.h>
#include <d3d11.h>
#include <wrl/client.h>

#include <cstdint>
#include <filesystem>
#include <string>

struct aji_ctx;

namespace anime4k::renderer {

struct AnimeJanaiPipelineTestAccess;

/** GPU-resident AnimeJaNai DirectML bridge using the upstream aji ABI. */
class AnimeJanaiPipeline {
 public:
  AnimeJanaiPipeline(ID3D11Device* device, ID3D11DeviceContext* context);
  ~AnimeJanaiPipeline();
  AnimeJanaiPipeline(const AnimeJanaiPipeline&) = delete;
  AnimeJanaiPipeline& operator=(const AnimeJanaiPipeline&) = delete;

  [[nodiscard]] bool execute(
      ID3D11Texture2D* source_texture,
      ID3D11ShaderResourceView* source_view,
      std::uint32_t source_width,
      std::uint32_t source_height,
      PipelineOutput& output,
      std::string& error);

  void clear_resources();
  [[nodiscard]] static std::filesystem::path find_runtime_directory();

 private:
  friend struct AnimeJanaiPipelineTestAccess;

  struct Api;

  [[nodiscard]] bool initialize(std::string& error);
  [[nodiscard]] bool ensure_configuration(
      std::uint32_t source_width,
      std::uint32_t source_height,
      std::string& error);
  [[nodiscard]] bool create_shaders(std::string& error);
  [[nodiscard]] bool create_frame_resources(
      std::uint32_t input_width,
      std::uint32_t input_height,
      std::uint32_t output_width,
      std::uint32_t output_height,
      std::string& error);
  void render_input(ID3D11ShaderResourceView* source_view);
  void destroy_context() noexcept;

  Microsoft::WRL::ComPtr<ID3D11Device> device_;
  Microsoft::WRL::ComPtr<ID3D11DeviceContext> context_;
  HMODULE module_{};
  Api* api_{};
  aji_ctx* aji_{};

  Microsoft::WRL::ComPtr<ID3D11VertexShader> vertex_shader_;
  Microsoft::WRL::ComPtr<ID3D11PixelShader> copy_shader_;
  Microsoft::WRL::ComPtr<ID3D11SamplerState> sampler_;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> input_texture_;
  Microsoft::WRL::ComPtr<ID3D11RenderTargetView> input_target_;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> output_texture_;
  Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> output_view_;
  std::uint32_t input_width_{};
  std::uint32_t input_height_{};
  std::uint32_t output_width_{};
  std::uint32_t output_height_{};
};

}  // namespace anime4k::renderer
