# AniWebScale

AniWebScale applies Anime4K and other anime-focused upscalers to HTML video
in real time. It ships as a Chrome/Firefox Manifest V3 extension and has an
optional Windows x64 renderer for frames that WebGPU cannot import.

The extension never rewrites `video.src`, reloads a stream, changes CORS
headers, or re-encodes media. Audio and playback stay with the website.

## Presets

All six official mode graphs can be combined with the `M`, `VL`, and `UL`
quality levels, for 18 selectable presets:

| Mode | Pipeline |
| --- | --- |
| A | Clamp → Restore → Upscale |
| B | Clamp → RestoreSoft → Upscale |
| C | Clamp → DenoiseUpscale |
| A+A | Clamp → Restore → Upscale → Restore → Upscale |
| B+B | Clamp → RestoreSoft → Upscale → RestoreSoft → Upscale |
| C+A | Clamp → DenoiseUpscale → Restore → Upscale |

`Output: Auto` targets the physical player size, including display scaling.
The double-stage modes remain selectable below 2× and show an oversharpening
warning. Quality is never silently reduced when rendering is too slow. Their UL
variants are explicit high-end GPU profiles and are outside the RX 6750 XT
24 FPS release baseline; every other preset is part of that baseline.

## AI upscale and frame generation

The Mode selector also exposes dedicated neural upscalers:

| Mode | Model and output |
| --- | --- |
| CNN Upscale x2 | Anime4K convolutional neural network, selectable M/VL/UL weights, fixed 2x internal output |
| ArtCNN C4F16 x2 | Official ArtCNN C4F16 fragment model, fixed 2x output |
| ACNet F8B4 x2 | Official neutral ACNet F8B4 fragment model, fixed 2x output |
| ARNet F8B8 x2 | Official neutral ARNet F8B8 fragment model, fixed 2x output |

Frame generation is an independent option. It retains two enhanced frames on
the GPU, estimates short-range motion, and inserts one motion-adaptive midpoint
for 2x presentation cadence. It adds one decoded-frame of visual latency and is
reset automatically after a source resize or renderer change.

Every upscale mode and frame generation can run through WebGPU or the native
Windows renderer. Auto uses Native for protected capture or unavailable WebGPU;
forcing WebGPU keeps those failures explicit instead of silently changing
backends.

## How it works

- AniWebScale stays idle during ordinary playback. It starts automatically only
  after the user enters a video player's Fullscreen API mode and stops when
  that fullscreen mode ends. There is no per-video AniWebScale button.
- On readable video, a WebGPU canvas follows `requestVideoFrameCallback` and
  keeps at most one current frame plus the newest replacement frame. DOM
  controls and subtitles remain owned by the website.
- The dedicated CNN mode uses the trained Anime4K weights on either backend.
  ArtCNN, ACNet, and ARNet use the pinned official GLSL weights translated at
  build time to WGSL and D3D11 compute shaders, with BT.709 luma/chroma
  reconstruction after the fixed 2x model.
- All inference is local; no video frame is sent to a server.
- Anime4K quality tiers and each generated neural model are separate lazy chunks;
  choosing one mode does not parse or load every other model into the tab.
- On EME/DRM, a `SecurityError`, or explicit `Backend: Native`, the extension
  can ask once per site for permission to use the local Windows renderer.
- The tab remains in its existing browser window. A random 128-bit title nonce
  identifies that existing fullscreen browser window for native capture; no
  browser popup is created and no tab is moved.
- `Anime4K.NativeHost.exe` uses the browser Native Messaging protocol and a
  current-user-only named pipe. `Anime4K.Renderer.exe` uses Windows Graphics
  Capture and Direct3D 11. No shader, weight, compiler, or executable is
  downloaded at runtime.

The native path does not bypass DRM. Crunchyroll, Widevine, Windows, the
browser, or the graphics driver can still return black protected frames. In
that case the renderer reports that protected content cannot be captured,
instructs the user to disable browser hardware acceleration and restart the
browser, and then restores the original tab and page state.

## Local installation

Install Node.js 20 or newer, then build both browsers:

```powershell
npm ci
npm run build:all
```

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select `dist-chrome`.

Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist-firefox/manifest.json`.

The unpacked Chrome ID is fixed to
`dlomjcbmgkfaebhplgoihbjfclaagike`. The Firefox ID is
`aniwebscale@korrespont.com`. Both values are verified from
`native/extension-identities.json` before a release build.

## Optional Windows renderer

Requirements:

- Windows 10/11 x64
- Visual Studio 2022 C++ Build Tools
- Windows 10/11 SDK with `fxc.exe`
- CMake 3.25 or newer
- Python 3.10 or newer (build-time shader packaging only)

Build and test it with:

```powershell
.\native\scripts\build.ps1 -Configuration Release
```

Install for the current user (no administrator rights) by double-clicking:

```text
native\Install Anime4K Native.cmd
```

The one-click installer copies the complete renderer, models, and runtimes to
LocalAppData and registers Chrome and Firefox. For a build-and-install command
from the repository, use:

```powershell
npm run install:native
```

Restart the browser after installing. Remove it by double-clicking
`native\Uninstall Anime4K Native.cmd` or with:

```powershell
npm run uninstall:native
```

Browser extensions cannot bootstrap a Native Messaging executable themselves:
Windows requires an external application installer to create the per-user host
registration. The included one-click installer is therefore the automatic
installation boundary.

## Tests and packages

```powershell
npm run typecheck
npm test
npm run build:all
npm run check:bundle-sizes
npm run test:e2e
npm run build:native
npm run package:local
```

Public store bundles must be built with the final HTTPS account URL. The release build refuses localhost and placeholder domains; see [`docs/RELEASE.md`](docs/RELEASE.md).

After deployment, `npm run check:live -- https://your-domain.example` runs the non-mutating final gate for HTTPS security, all three paid plans, Stripe/Neon readiness, signed-license verification, CORS and store links.

`npm run package:local` creates:

- `artifacts/chrome-unpacked/`
- `artifacts/aniwebscale-chrome-1.0.0.zip`
- `artifacts/aniwebscale-firefox-1.0.0.xpi`
- `artifacts/aniwebscale-native-windows-x64-1.0.0.zip`

The native ZIP contains `Install Anime4K Native.cmd`; extract the ZIP and
double-click that file to install the complete backend.

Before the first browser E2E run, use `npm run test:e2e:install`; details are
in [`tests/e2e/README.md`](tests/e2e/README.md).

Automated protocol, settings, graph, and native unit tests are included. GPU
golden-image testing, the RX 6750 XT performance target, and ten-minute
Crunchyroll smoke tests require the target hardware, installed browsers, and a
Crunchyroll account; they are not implied by a successful source build.
The reproducible checklist is in [`docs/TESTING.md`](docs/TESTING.md).

## Security and privacy

- No telemetry.
- No administrator installation.
- Website access is optional and granted per origin from the popup; the
  production manifest does not request blanket access at installation time.
- The native host accepts a fixed command schema and fixed extension IDs. It
  accepts no arbitrary HWND, filesystem path, URL, program, or command line.
- Native site permissions can be revoked in the extension settings.
- Session cleanup is shared across stop, navigation, tab close, renderer loss,
  and browser restart recovery.

## License

This project is MIT licensed. It derives from the MIT-licensed Anime4K,
Anime4K-WebGPU, Anime4K-WebExtension, ArtCNN, and ACNetGLSL projects. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for attribution. Magpie is
not used or bundled.
