#pragma once

#include <d3d11.h>
#include <wrl/client.h>

#include <string>

namespace anime4k::renderer {

class FrameGenerationPipeline {
 public:
  FrameGenerationPipeline(ID3D11Device* device, ID3D11DeviceContext* context);
  ~FrameGenerationPipeline() = default;
  FrameGenerationPipeline(const FrameGenerationPipeline&) = delete;
  FrameGenerationPipeline& operator=(const FrameGenerationPipeline&) = delete;

  // Copies the enhanced frame into a persistent ping-pong history. The first
  // frame seeds both sides; later frames expose a previous/current pair.
  [[nodiscard]] bool push_frame(ID3D11Texture2D* source, bool& has_intermediate, std::string& error);
  [[nodiscard]] bool bind_for_presentation(float factor, std::string& error);
  void unbind() noexcept;
  void clear_resources() noexcept;
  [[nodiscard]] bool has_history() const noexcept { return history_ready_; }
  [[nodiscard]] bool has_intermediate() const noexcept { return pair_ready_; }

 private:
  [[nodiscard]] bool initialize(std::string& error);
  [[nodiscard]] bool ensure_history(const D3D11_TEXTURE2D_DESC& source_description, std::string& error);

  Microsoft::WRL::ComPtr<ID3D11Device> device_;
  Microsoft::WRL::ComPtr<ID3D11DeviceContext> context_;
  Microsoft::WRL::ComPtr<ID3D11PixelShader> interpolation_shader_;
  Microsoft::WRL::ComPtr<ID3D11Buffer> interpolation_constants_;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> previous_texture_;
  Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> previous_view_;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> current_texture_;
  Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> current_view_;
  D3D11_TEXTURE2D_DESC history_description_{};
  bool history_ready_{};
  bool pair_ready_{};
};

}  // namespace anime4k::renderer
