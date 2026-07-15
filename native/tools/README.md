# Anime4K native shader generation

`generate_anime4k_models.py` converts the pinned official Anime4K, ArtCNN, and
ACNetGLSL mpv GLSL subsets under `native/third_party` into one Direct3D 11
Shader Model 5 compute kernel per upstream pass. It also writes `manifest.json`,
which is the runtime resource graph for the native renderer.

## Regeneration and validation

From the repository root:

```powershell
python native/tools/generate_anime4k_models.py
python native/tools/generate_anime4k_models.py --check
python native/tools/generate_anime4k_models.py --check --validate-fxc
python -m unittest discover -s native/tools/tests -v
```

`--validate-fxc` locates the newest Windows SDK x64 `fxc.exe` and writes only
temporary `.cso` files below `.tmp/anime4k-fxc`. DXBC is intentionally not
checked in. Generation uses no network and no third-party Python packages.

### Packing compiled models into the renderer

`pack_anime4k_models.py` combines the manifest and all FXC outputs into one
generated `.cpp`. Its `--cso-map` JSON contains an exact pass-ID-to-CSO mapping:

```json
{
  "schema_version": 1,
  "passes": {
    "clamp.pass_000": "hlsl/clamp/pass_000.cso",
    "restore_m.pass_000": "hlsl/restore_m/pass_000.cso"
  }
}
```

Paths are relative to the map file. Every manifest pass must be present and no
unknown keys are accepted. Inputs must be non-empty DXBC containers. Generate
the package with:

```powershell
python native/tools/pack_anime4k_models.py `
  --manifest native/generated-models/manifest.json `
  --cso-map build/generated/anime4k-cso-map.json `
  --output build/generated/anime4k_model_package.cpp
```

The translation unit includes `anime4k/model_package.hpp` and implements its
exact `anime4k::models` ABI:

- `effects()` and `presets()` expose the immutable descriptor arrays;
- `find_effect(id)` resolves an effect;
- `find_preset(mode, quality)` resolves one of the 30 native presets.

DXBC and all strings/descriptor arrays have static lifetime. The header remains
small; the multi-megabyte bytecode is emitted only in the generated `.cpp`.

## D3D11 binding contract

For every pass in `native/generated-models/manifest.json`:

1. Resolve each `bindings` entry to the renderer's current logical texture and
   bind its SRV at the stated `srv_slot` (`t0`, `t1`, ...).
2. Fill `Anime4KPassConstants` at `b0` with four 32-bit values for output width,
   output height, and two zeroes, followed by one 16-byte `uint4` per SRV. The
   first two values of each `uint4` are that input texture's width and height.
3. Bind a linear, clamp-address sampler at `s0` and a fresh
   `R16G16B16A16_FLOAT` UAV at `u0`. Never bind the same D3D11 resource as an
   SRV and UAV simultaneously, including when `replaces_bound_resource` is
   true.
4. Evaluate `width_rpn` and `height_rpn` against current logical-resource
   dimensions, allocate the output, then dispatch `ceil(width/8)` by
   `ceil(height/8)` by one groups. `when_rpn` uses mpv's postfix expression
   syntax; `OUTPUT.w/h` are the final requested output dimensions.
5. After dispatch, atomically replace the output `logical_resource` in the
   invocation's resource map. Temporary resources are local to one model
   invocation; only `MAIN` crosses effect boundaries. Release intermediate
   textures after their last use or return them to a descriptor-compatible
   pool.

The `aliases` object documents mpv aliases compiled into a shader. It does not
consume an extra SRV slot. At effect entry, both `MAIN` and `HOOKED` refer to the
current video texture. A pass that saves `MAIN` becomes the effect output. A
clamp pass without `SAVE` has logical output `HOOKED`, which likewise becomes
the current effect texture.

Preset entries expand all six canonical modes plus CNN x2,
ArtCNN, ACNet, and ARNet across the three wire-protocol qualities into concrete
effect IDs. The three external GLSL models deliberately resolve
to their fixed upstream profiles for every quality value. Repeated effects in
AA, BB, and CA must receive a fresh invocation scope so identically named CNN
intermediates cannot collide.

## Conversion guarantees and caveats

- Every upstream float literal and CNN weight is retained as source text. No
  model is substituted across M, VL, or UL.
- ArtCNN C4F16 is pinned to the last official fragment-shader release, v1.1.0;
  newer ArtCNN releases use compute-shader primitives outside this translator's
  deterministic fragment-pass contract. ACNet F8B4 and ARNet F8B8 are pinned
  to ACNetGLSL v3.2.0. Their luma models receive BT.709 luma and finish with a
  generated 2x pixel-shuffle/chroma reconstruction pass.
- GLSL `mat4(...) * vector` is emitted as `mul(vector, float4x4(...))`. This is
  intentional: GLSL constructor values fill columns, while this HLSL form with
  the same values produces the corresponding result.
- mpv texture helpers are modeled with a normalized-coordinate linear sampler
  and half-texel clamp. CNN taps land on texel centers; depth-to-space retains
  mpv's explicit subpixel addressing. Small floating-point differences between
  GLSL drivers and D3D11/FXC remain possible, so image tests should use a
  tolerance instead of byte equality.
- Upstream `//!WHEN` conditions are preserved, not silently evaluated by the
  generator. The renderer must skip the complete upscale model when its
  condition is false; otherwise partially executed CNN resources would be
  invalid.
- The generated clamp statistics use RGBA16F like every other intermediate,
  even though their semantic component count is one. This keeps the fixed
  typed-UAV contract and is reflected by `components: 1` in the manifest.
