# Testing

## Automated checks

```
npm ci
npm run lint
npm run typecheck
npm test
npm run build:all
npm run check:bundle-sizes
npm run test:e2e:install
npm run test:e2e
```

The TS suite checks all 18 preset graphs, physical Auto sizing, legacy-settings migration, backend forcing/fallback, strict native messages, 128-bit nonce validation, storage-change routing, and orphan-session selection. Chrome and Firefox E2E are mandatory. Chrome fails when WebGPU or Fullscreen is unavailable. The build gate rejects lazy JS chunks over 750 KiB.

## Shader golden tests

Compare all 18 production WebGPU and D3D11 graphs against the pinned official Anime4K GLSL (FFmpeg/libplacebo/Vulkan). Nine additional 4x cases run AA, BB, CA in every quality with their second upscale pass:

```
python tests/golden/run_shader_golden.py --native-exe native/build/bin/Release/Anime4K.Golden.exe --report artifacts/shader-golden-report.json
```

Browser E2E fixtures are local (no streaming service). They cover same-origin/CORS media, iframes, dynamic video replacement, auto fullscreen, DOM subtitles, navigation, and teardown.

## Linux native host (ncnn/Vulkan)

The optional Linux RealESRGAN host has its own golden tests and benchmarks (all
run against the built `native/linux-host/build/aniwebscale-ncnn-host`):

```
python3 tests/host-target-downscale.py                       # fp16 identity/box/tiled
ANIWEBSCALE_NO_FP16=1 ANIWEBSCALE_FP32_BUDGET_MS=0 python3 tests/host-target-downscale.py
python3 tests/host-http-transport.py                         # HTTP vs stdin parity
ANIWEBSCALE_NO_FP16=1 python3 bench/wall-probe-e2e-sizes.py  # 15 fps budget
.venv-realesrgan/bin/python bench/native-fp32-governor-evidence.py
npm run bench:ncnn                                           # isolated GPU benchmark
```

Details, flags and environment variables are in
[`native/linux-host/README.md`](../native/linux-host/README.md).

The `generate:pixels-wasm` build step needs the `wasm32-unknown-unknown` Rust
target. System toolchains without rustup keep a previously built
`wasm/pixels.wasm` with a warning; CI (`--check`) still requires a real rebuild,
so install the target (`rustup target add wasm32-unknown-unknown`) before
releasing.

## Hardware performance (native Windows only)

Run the bounded native acceptance benchmark on an RX 6750 XT:

```
.\native\scripts\run-benchmark.ps1 -BinaryDirectory .\native\build\bin\Release -WarmupFrames 3 -SampleFrames 30 -OutputPath .\artifacts\native-rx6750xt-benchmark.json
```

The checked-in [RX 6750 XT report](../artifacts/native-rx6750xt-benchmark.json) passed 15/18 canonical combinations. `AA/UL`, `BB/UL`, `CA/UL` are explicit high-load profiles outside the 24 FPS baseline.

## Resource-cycle test

Enter and leave player fullscreen 20 times, changing presets, navigating, closing the window, terminating the renderer. Verify: only one overlay, DOM styles restored, no popup or tab movement, native processes exit, VRAM and handle counts return to baseline.