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
python tests/golden/run_shader_golden.py --native-exe native/build/bin/Anime4K.Golden.exe --report artifacts/shader-golden-report.json
```

Browser E2E fixtures are local (no streaming service). They cover same-origin/CORS media, iframes, dynamic video replacement, auto fullscreen, DOM subtitles, navigation, and teardown.

## Hardware performance (native Windows only)

Run the bounded native acceptance benchmark on an RX 6750 XT:

```
.\native\scripts\run-benchmark.ps1 -BinaryDirectory .\native\build-exact\bin -WarmupFrames 3 -SampleFrames 30 -OutputPath .\artifacts\native-rx6750xt-benchmark.json
```

The checked-in [RX 6750 XT report](../artifacts/native-rx6750xt-benchmark.json) passed 15/18 canonical combinations. `AA/UL`, `BB/UL`, `CA/UL` are explicit high-load profiles outside the 24 FPS baseline.

## Resource-cycle test

Enter and leave player fullscreen 20 times, changing presets, navigating, closing the window, terminating the renderer. Verify: only one overlay, DOM styles restored, no popup or tab movement, native processes exit, VRAM and handle counts return to baseline.