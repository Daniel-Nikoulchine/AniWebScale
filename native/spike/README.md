# ncnn-Vulkan spike (RealESRGAN AnimeVideo-v3 x4)

Phase 0-2 of the Vulkan-only plan, executed on the target hardware (AMD RX
6750 XT, RADV). The Windows-only D3D11 renderer is untouched; the native
renderer protocol still rejects REALESRGAN as a native mode.

## What is here

- `ncnn_realesrgan_spike.cpp` — standalone Vulkan compute diagnostic. Loads the
  pinned ncnn artifacts, uploads one frame, runs the graph, downloads the 4x
  result, and reports device/queue/memory/FP16 capability plus per-frame
  timing. `--fp16` enables half-precision storage (fp32 arithmetic), matching
  the reference implementation's fp16s mode.
- `CMakeLists.txt` — builds the spike together with the pinned ncnn source.
  The Windows x64 build uses the same commands with the VS generator.
- `fetch-sources.py` — downloads ncnn + its glslang submodule at the pinned
  revisions and verifies both SHA-256 hashes from `third_party/PINS.json`.
  The ncnn tree is not checked in.
- `validate-ncnn-model.py` — Phase 2 quality gate. Runs the pinned fp32 ONNX
  model with onnxruntime as the reference and compares SSIM (7x7 Gaussian,
  sigma 1.5, complete windows, same estimator as `tests/golden/`), RMSE, and
  p99 absolute error against the spike PNGs.
- `models/realesrgan/ncnn/` (repo root) — the official
  `realesr-animevideov3-x4.param/.bin` artifacts from the Real-ESRGAN v0.2.5.0
  release plus the model license, with hashes pinned in `third_party/PINS.json`.

## Build and run

```bash
python3 native/spike/fetch-sources.py
cmake -S native/spike -B native/spike/build-spike -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build native/spike/build-spike
native/spike/build-spike/ncnn-spike -i frame.png -o out.png \
  -p models/realesrgan/ncnn/realesr-animevideov3-x4.param \
  -b models/realesrgan/ncnn/realesr-animevideov3-x4.bin \
  --warmup 3 --frames 10          # add --fp16 for half storage
```

## Validated results (RX 6750 XT, RADV, Vulkan 1.4.354)

Input 480x270 -> output 1920x1080, 10 measured frames after 3 warmup frames:

| Storage   | synthetic p50 | real anime p50 | SSIM (min 0.985) | RMSE (max 0.035) | p99 (max 0.135) |
|-----------|---------------|----------------|------------------|------------------|-----------------|
| fp32      | 64.1 ms       | 59.7 ms        | 0.99985 / 1.00000 | 0.00061 / 0.000004 | 0.0039 / 0.0000 |
| fp16      | 45.3 ms       | 44.4 ms        | 0.99966 / 1.00000 | 0.00096 / 0.000004 | 0.0039 / 0.0000 |

fp16 storage is ~30% faster than fp32 and costs no measurable quality; both
modes pass the official-shader tolerances with large margins. The machine
readable report is written to `artifacts/ncnn-vulkan-quality-report.json`
(gitignored; regenerate with the validator).

## GPU post-process (zero-copy output)

With `--fp16` the spike converts the network's planar fp16 output to packed
RGBA8 **on the GPU** (`shaders/realesrgan_spike_postproc.comp`, compiled at
build time and recorded into the same VkCompute as the graph). The host then
downloads 4 bytes per pixel instead of 8 and performs no per-pixel work.
Rounding matches the reference postproc exactly (`x*255+0.5`, floor, clamp);
the GPU and CPU paths produce bit-identical PNGs. Measured A/B on the real
anime frame: GPU postproc ~19.5 ms p50 vs CPU convert+download ~32.6 ms p50
(both under system load; the relative ~40% saving is the point).

Two build-chain pitfalls are worth repeating: `file(READ ... HEX)` yields the
SPIR-V in file byte order, so each uint32 word must be assembled little-endian
(bytes `03 02 23 07` form the word `0x07230203`); and with a mappable blob
allocator (ReBAR) every download must be followed by `submit_and_wait()` before
the host touches the data — the CPU fallback initially raced the queue and read
zeros.

## Lifetime rules encoded in the spike (RADV + ReBAR)

- The blob allocator is mappable under ReBAR, so the download clone returns a
  Mat aliasing device memory. Read it before reclaiming the allocator.
- Reclaim the per-frame allocators only after the frame's VkMats and VkCompute
  are destroyed; the reference implementation scopes exactly this way.
- `ncnn::Net` must outlive every buffer it allocated and die before
  `ncnn::destroy_gpu_instance()`.
- `ncnn::Mat::row(y)` indexes channels when `c > 1`; planar access goes through
  `data + cstep` offsets.
- With `use_fp16_storage` the output blob is a half Mat: cast back with
  `cast_float16_to_float32` before reading it as floats.

## Not decided yet (Phase 3+)

Vulkan-pipeline module behind the native renderer seam, backend selection,
fused/persistent optimisation, installer payload. The Windows renderer side
requires the D3D11 CMake tree and is deliberately out of scope here.
