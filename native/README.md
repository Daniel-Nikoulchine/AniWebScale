# AniWebScale native Windows helper

This directory contains the optional Windows x64 backend for video frames that
cannot be imported by the extension's WebGPU path.

- `Anime4K.NativeHost.exe` is a strict Native Messaging broker. It accepts
  length-prefixed UTF-8 JSON on stdin/stdout, checks every command against the
  version-3 schema, validates the browser-supplied extension origin against a
  fixed allowlist, and relays messages over a current-user-only named pipe. The
  browser's Native Messaging registry/manifest is the caller trust boundary;
  the command-line origin string is not cryptographic process authentication.
- `Anime4K.Renderer.exe` locates the existing fullscreen browser window by a
  128-bit title nonce, verifies that it belongs to a known browser process, captures it with
  Windows Graphics Capture, runs the selected D3D11 pipeline, and
  presents the newest frame in a borderless flip-model window. Native frame
  generation keeps two processed D3D11 frames and inserts a motion-adaptive midpoint.
- No Magpie code or binary is used. No DRM is bypassed. Protected content may
  still be returned as black frames by Windows, the browser, or the CDM.

## Requirements

- Windows 10/11 x64 with Windows Graphics Capture support
- Visual Studio 2022 C++ Build Tools
- Windows 10/11 SDK including `fxc.exe`
- CMake 3.25 or newer
- Python 3.10 or newer (build-time generation and tests only)

## Build and test

From PowerShell:

```powershell
.\native\scripts\build.ps1 -Configuration Release
```

Or from an x64 Visual Studio Developer Command Prompt:

```text
cmake -S native -B native/build -G Ninja
cmake --build native/build
ctest --test-dir native/build --output-on-failure
```

## RX 6750 XT acceptance benchmark

`Anime4K.Benchmark.exe` runs the exact embedded D3D11 preset graph for all 18
canonical mode/quality pairs plus the fixed ArtCNN, ACNet, and ARNet profiles
against a synthetic 1920x1080 BGRA frame, followed by the normal 2560x1440
presentation resample. GPU timestamp queries synchronize every warmup and
measured frame. The bounded runner requires an RX 6750 XT by default and writes
p50/p95 time, throughput, 24 fps budget misses, an estimated dropped frame
count, and DXGI local-memory usage to JSON:

```powershell
.\native\scripts\run-benchmark.ps1 -WhatIf
.\native\scripts\run-benchmark.ps1 `
  -BinaryDirectory .\native\build-exact\bin `
  -WarmupFrames 3 -SampleFrames 30 -MaximumSeconds 600 `
  -OutputPath .\artifacts\native-rx6750xt-benchmark.json
```

Remove `-WhatIf` only when the hardware benchmark should actually run. Override
`-RequiredAdapter` only for an intentional non-acceptance diagnostic run. The
runner exits unsuccessfully if a release-baseline frame exceeds the 24 FPS
budget. Double-stage UL is reported as an explicit high-load profile but is not
part of that baseline. `-AllowBudgetMisses` keeps any over-budget run usable as
a diagnostic.

The measured RX 6750 XT report from 2026-07-18 is checked in at
[`artifacts/native-rx6750xt-benchmark.json`](../artifacts/native-rx6750xt-benchmark.json).
All release-target profiles met the 41.67 ms frame budget in every sample. The
three explicit high-load profiles outside that baseline were `AA/UL` (59.027 ms
average, 62.204 ms p95), `BB/UL` (58.563 ms average, 59.708 ms p95), and `CA/UL`
(49.391 ms average, 50.542 ms p95). The schema-2 report therefore records
`acceptancePassed: true` and `allPresetsWithinFrameBudget: false`. No quality
level was reduced automatically.

The same 30-sample run measured the 1080p inputs at 6.306 ms average / 7.274 ms
p95 for ArtCNN C4F16, 1.918 / 2.983 ms for ACNet F8B4, and 5.361 / 6.255 ms for
ARNet F8B8. Each recorded zero misses against the 41.67 ms (24 fps) frame
budget; results remain hardware-dependent.

## Local installation

From a packaged native ZIP, extract all files and double-click
`Install Anime4K Native.cmd`. It installs for the current user, needs no
administrator rights, and includes the required third-party license files.
The shader models themselves are embedded in `Anime4K.Renderer.exe`.

From the repository, build and install in one command:

```powershell
npm run install:native
```

The underlying script remains available for automation:

```powershell
.\native\scripts\install-native-host.ps1 `
  -BinaryDirectory .\native\build\bin\Release
```

Defaults are tied to the local extension identities:

- Chrome: `dlomjcbmgkfaebhplgoihbjfclaagike`
- Firefox: `aniwebscale@korrespont.com`
- Host: `io.github.anime4k_browser.native`

The Chrome and Firefox extension IDs are defined in
`extension-identities.json` and verified against the installer, packages, and
native-host allowlist. Installation
uses HKCU only and does not require administrator privileges. Uninstall with:

```powershell
npm run uninstall:native
```

## Protocol

All browser requests contain `type`, `protocolVersion: 3`, and `requestId`.
Session commands additionally contain `sessionId`. Supported requests are
`hello`, `capabilities`, `start`, `updateConfiguration`, `status`, and `stop`. Start
accepts only a 32-character lowercase hexadecimal
`windowNonce`, a mode (`OFF`, `A`, `B`, `C`, `AA`, `BB`, `CA`, `CNNX2`,
`ARTCNN`, `ACNET`, or `ARNET`), a quality (`M`, `VL`, `UL`), an explicit
`frameGenerationEnabled` boolean, and optional paired target/capture dimensions.
`updateConfiguration` carries the same three processing fields. It intentionally
accepts no HWND, path, command line, URL, or executable field.

The renderer emits correlated `ready`, `capabilities`, `status`, `stopped`, and
`error` responses plus asynchronous `metrics`, `pointer`, and `mediaCommand`
events; `pointer` and `mediaCommand` are renderer-to-extension input events, not
renderer input commands. Capabilities report the supported modes, qualities,
and frame-generation support. Frames larger than 1 MiB, duplicate JSON keys, unknown fields, invalid
enums, malformed identifiers, and protocol-version mismatches are rejected.

The renderer probes five small regions every 15 rendered frames. While a fresh
playback heartbeat confirms that media time is advancing, a capture with at
least 95% near-black sampled pixels for 15 seconds and eight seconds of media
advance, or a bit-identical sample for 30 seconds and 15 seconds of media
advance, is treated as blocked protected content. Paused playback and stale
heartbeats are never classified as capture failures. On detection the renderer
emits `Protected content cannot be captured on this system`, stops the capture,
and releases the capture/output resources. These conservative thresholds avoid
classifying ordinary fades, static cuts, or paused frames as DRM failures.

## Shader fidelity

The native backend embeds 286 compute kernels generated from pinned official
Anime4K 4.x, ArtCNN, and ACNetGLSL sources. It executes the manifest's exact
Clamp, Restore, RestoreSoft, DenoiseUpscale, Upscale CNN,
ArtCNN C4F16, ACNet F8B4, and ARNet F8B8 graphs. All 30 native mode/quality
combinations run in the automated D3D11 WARP test. Minor pixel differences
between GLSL and HLSL/D3D sampler arithmetic remain possible; hardware golden
comparisons therefore use documented numeric tolerances. The three-way suite
executes the pinned official GLSL through FFmpeg/libplacebo, reads back the
production WebGPU and D3D11 outputs, and gates every preset on SSIM, RMSE, and
p99 absolute error. Dedicated 4x cases activate the second upscale pass in AA,
BB and CA. See `../tests/golden/README.md`, `shaders/README.md`, and
`tools/README.md`.
