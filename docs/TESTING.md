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
cd website
npm test
npm run check:types
npm run test:database:restore
npm run test:live:local
npm run check:cloudflare
npm run test:cloudflare:local
cd ..
.\native\scripts\build.ps1 -Configuration Release
python native/tools/generate_anime4k_models.py --check --validate-fxc
python -m unittest discover -s native/tools/tests -v
```

The TypeScript suite checks all 18 preset graphs, physical Auto output sizing,
legacy-settings migration, backend forcing/fallback, strict native messages,
128-bit nonce validation, storage-change routing, and orphan-session selection. The
browser build gate requires separate on-demand quality/model chunks and rejects
any lazy JavaScript chunk over 750 KiB. Chrome and Firefox extension E2E are
mandatory in CI; Chrome fails rather than skips when WebGPU or Fullscreen is unavailable and Axe checks popup, settings and onboarding for serious/critical accessibility violations. The website suite also executes versioned migrations, an
AES-256-GCM backup and tombstone-safe restore inside embedded PostgreSQL; CI
repeats the restore against a disposable PostgreSQL 17 service. Native CTest checks
framed JSON, strict schemas, capture-health thresholds, pointer normalization,
the embedded model inventory, and actual execution of all 18 canonical compute
graphs plus the fixed CNN, ArtCNN, ACNet, and ARNet graphs on the D3D11 WARP
device. The native suite also runs 20,000 deterministic parser/schema fuzz cases.
`.github/workflows/native-fuzz.yml` expands that budget to 250,000 cases for
each of three reproducible seeds every week; a reported seed can be replayed with
`ANIME4K_FUZZ_SEED` and `ANIME4K_FUZZ_ITERATIONS`. A dedicated `windows-latest` CI job builds the complete native payload,
runs CTest and publishes only the tested binaries.

## Shader golden and cross-backend fidelity

The hardware integration suite compares all 18 production WebGPU and D3D11
graphs against the pinned official Anime4K GLSL executed independently by
FFmpeg/libplacebo/Vulkan. Nine additional 4x cases run AA, BB and CA in every
quality with their second upscale pass active. It uses real float/SSIM
tolerances rather than output hashes or non-empty checks:

```powershell
python tests/golden/run_shader_golden.py `
  --native-exe native/build/bin/Anime4K.Golden.exe `
  --report artifacts/shader-golden-report.json
```

The runner performs no downloads and fails if local FFmpeg/libplacebo,
Playwright Chromium, WebGPU, Vulkan, or the native executable is unavailable.
The exact fixture, metrics, thresholds, dependencies, and alternate Visual
Studio executable path are documented in `tests/golden/README.md`.

Browser E2E fixtures are local and do not depend on a streaming service. They
cover same-origin and CORS-enabled media, iframes, dynamic video replacement,
multiple videos, no-start playback, automatic fullscreen start/stop, direct
video-fullscreen redirection, disabled automation, DOM subtitles/controls,
navigation, and teardown. See the E2E
runner's output for platform-specific skips such as unattended fullscreen.

## Hardware performance run

Run the bounded native acceptance benchmark on an RX 6750 XT:

```powershell
.\native\scripts\run-benchmark.ps1 `
  -BinaryDirectory .\native\build-exact\bin `
  -WarmupFrames 3 -SampleFrames 30 `
  -OutputPath .\artifacts\native-rx6750xt-benchmark.json
```

It executes all 18 presets with a synthetic 1920x1080 input and 2560x1440
output and writes synchronized GPU p50/p95, budget misses, drop estimates, and
DXGI memory telemetry. The command fails if a release-baseline profile exceeds
the 24 FPS budget. `-AllowBudgetMisses` is only for keeping a failed diagnostic
report; it must not be used for release acceptance.

The checked-in [RX 6750 XT report](../artifacts/native-rx6750xt-benchmark.json)
from 2026-07-17 passed 15 of 18 canonical combinations. `AA/UL`, `BB/UL`, and `CA/UL`
remain explicit high-load profiles outside the 24 FPS release baseline. Schema
2 records both gates: `acceptancePassed` covers the 15 baseline combinations,
while `allPresetsWithinFrameBudget` remains false and must not be presented as
an all-presets pass. The same report also records the three fixed AI profiles,
all within budget.

For a longer live 24 FPS playback soak:

1. Close other GPU-heavy applications and select every mode/quality pair.
2. Let each pair run for at least two minutes after shader warm-up.
3. Record source FPS, output FPS, p50/p95 render time, peak dedicated VRAM, and
   dropped frames.
4. Verify latency does not grow and no preset changes automatically.
5. Treat a warning as valid at higher resolutions/frame rates; never accept an
   automatic quality downgrade.

Results remain hardware-, driver-, browser-, and monitor-specific; the bounded
report does not replace the longer live latency/AV-sync soak.

## Crunchyroll DRM smoke test

Repeat in current Chrome and Firefox on Windows 10/11 x64:

1. Install the extension and current-user native package, then restart the
   browser.
2. Start a protected Crunchyroll episode and grant native permission for the
   site.
3. Enter the site's player fullscreen; verify Native starts without creating a
   browser popup or moving the tab.
4. Run at least ten minutes while checking audio sync, subtitles, seeking,
   volume, pointer input, keyboard input, and stop/restore.
5. If Windows, Widevine, the browser, or the driver blocks capture, verify the
   `Protected content cannot be captured` error with the hardware-acceleration
   guidance and verify that the tab, title, CSS, and original window position
   are restored.

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
