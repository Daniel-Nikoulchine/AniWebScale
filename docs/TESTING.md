# Testing and acceptance

## Automated checks

Run the complete source checks from PowerShell:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build:all
npm run check:bundle-sizes
npm run test:e2e:install
npm run test:e2e
```

The TypeScript suite checks all 18 preset graphs, physical Auto output sizing,
legacy-settings migration, backend forcing/fallback, strict native messages,
128-bit nonce validation, storage-change routing, and orphan-session selection.
Chrome and Firefox extension E2E are mandatory in CI; Chrome fails rather than skips
when WebGPU or Fullscreen is unavailable and Axe checks popup, settings and onboarding
for serious/critical accessibility violations. The browser build gate requires separate
on-demand quality/model chunks and rejects any lazy JavaScript chunk over 750 KiB.

## Shader golden and cross-backend fidelity

The hardware integration suite compares all 18 production WebGPU and D3D11 graphs
against the pinned official Anime4K GLSL executed independently by
FFmpeg/libplacebo/Vulkan. Nine additional 4x cases run AA, BB and CA in every quality
with their second upscale pass active. It uses real float/SSIM tolerances rather than
output hashes or non-empty checks:

```powershell
python tests/golden/run_shader_golden.py `
  --native-exe native/build/bin/Anime4K.Golden.exe `
  --report artifacts/shader-golden-report.json
```

The runner performs no downloads and fails if local FFmpeg/libplacebo, Playwright
Chromium, WebGPU, Vulkan, or the native executable is unavailable.

Browser E2E fixtures are local and do not depend on a streaming service. They cover
same-origin and CORS-enabled media, iframes, dynamic video replacement, multiple
videos, no-start playback, automatic fullscreen start/stop, direct video-fullscreen
redirection, disabled automation, DOM subtitles/controls, navigation, and teardown.

## Hardware performance run

Run the bounded native acceptance benchmark on an RX 6750 XT:

```powershell
.\native\scripts\run-benchmark.ps1 `
  -BinaryDirectory .\native\build-exact\bin `
  -WarmupFrames 3 -SampleFrames 30 `
  -OutputPath .\artifacts\native-rx6750xt-benchmark.json
```

It executes all 18 presets with a synthetic 1920x1080 input and 2560x1440 output and
writes synchronized GPU p50/p95, budget misses, drop estimates, and DXGI memory
telemetry. The command fails if a release-baseline profile exceeds the 24 FPS budget.
`-AllowBudgetMisses` is only for keeping a failed diagnostic report; it must not be
used for release acceptance.

The checked-in [RX 6750 XT report](../artifacts/native-rx6750xt-benchmark.json)
from 2026-07-17 passed 15 of 18 canonical combinations. `AA/UL`, `BB/UL`, and `CA/UL`
remain explicit high-load profiles outside the 24 FPS release baseline. Schema 2
records both gates: `acceptancePassed` covers the 15 baseline combinations, while
`allPresetsWithinFrameBudget` remains false and must not be presented as an
all-presets pass. The same report also records the three fixed AI profiles, all
within budget.

For a longer live 24 FPS playback soak:

1. Close other GPU-heavy applications and select every mode/quality pair.
2. Let each pair run for at least two minutes after shader warm-up.
3. Record source FPS, output FPS, p50/p95 render time, peak dedicated VRAM, and
   dropped frames.
4. Verify latency does not grow and no preset changes automatically.
5. Treat a warning as valid at higher resolutions/frame rates; never accept an
   automatic quality downgrade.

## Crunchyroll DRM smoke test

Repeat in current Chrome and Firefox on Windows 10/11 x64:

1. Install the extension and current-user native package, then restart the browser.
2. Start a protected Crunchyroll episode and grant native permission for the site.
3. Enter the site's player fullscreen; verify Native starts without creating a
   browser popup or moving the tab.
4. Run at least ten minutes while checking audio sync, subtitles, seeking, volume,
   pointer input, keyboard input, and stop/restore.
5. If Windows, Widevine, the browser, or the driver blocks capture, verify the
   `Protected content cannot be captured` error with the hardware-acceleration
   guidance and verify that the tab, title, CSS, and original window position are
   restored.

This test verifies behavior; it cannot guarantee that a protected surface is
capturable on another system. The renderer does not bypass DRM.

## Resource-cycle test

Enter and leave player fullscreen 20 times, then repeat while changing presets,
navigating, closing the source window, and terminating the renderer. Check that:

- only one overlay/output window exists at a time;
- the source video opacity and DOM styles return to their original values;
- no browser popup or tab movement occurs and the original title is restored;
- the native host and renderer processes exit;
- dedicated VRAM and process handle counts return close to the warmed baseline.
