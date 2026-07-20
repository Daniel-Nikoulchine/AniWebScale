# Native shader pipeline

`fullscreen.hlsl` and `present.hlsl` implement the final letterboxed swap-chain
presentation. CMake compiles them with `fxc.exe`, and
`cmake/EmbedBinary.cmake` turns their DXBC into generated C++ headers.

The model kernels are the 286 generated compute shaders under
`generated-models/hlsl`. They preserve the official model weights and pass
math from the pinned Anime4K, ArtCNN, and ACNetGLSL sources under `third_party`.
`generated-models/manifest.json` defines all resource bindings, dimension and
WHEN expressions, 16 effects, and all 30 native presets.

During a normal build, all compute kernels are compiled as Shader Model 5.0
DXBC. `tools/pack_anime4k_models.py` validates and embeds them with the graph in
one generated C++ translation unit. The installed renderer therefore loads no
shader files and invokes no runtime shader compiler.

## Verification boundary

All 286 kernels build with FXC `/Ges /WX /O3`; a D3D11 WARP test executes every
one of the 30 preset graphs and checks its output. Exact floating-point pixels
may differ slightly from GLSL because D3D11 and OpenGL sampler and arithmetic
implementations are not bit-identical, so hardware golden-image comparisons
must use a documented tolerance.
