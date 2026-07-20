# Browser end-to-end tests

The harness uses only local fixtures. Two loopback servers provide a same-origin
video, a CORS-enabled video origin, and a cross-origin iframe. The VP9 fixture is
embedded in `server.mjs`, so neither network access nor ffmpeg is needed at test
time.

## First run

```powershell
npm run test:e2e:install
npm run test:e2e
```

`test:e2e:install` stores Playwright Chromium and Firefox under the ignored
`.tmp/ms-playwright` directory. This is intentional: current branded Chrome
releases may reject the command-line flags used to side-load unpacked
extensions, while Playwright's Chromium build supports them.

Run one browser only with:

```powershell
npm run test:e2e:chrome
npm run test:e2e:firefox
```

Set `E2E_HEADED=1` for a visible Chromium run. Set `E2E_CHROMIUM_BINARY` or
`FIREFOX_BINARY` to use explicit browser executables. A missing Firefox is a
test failure so cross-browser acceptance cannot silently lose half its scope.
Firefox runs headed by default because its Windows headless mode currently
exposes `navigator.gpu` without returning a GPU adapter. Set
`E2E_FIREFOX_HEADLESS=1` only for injection diagnostics; live WebGPU checks are
expected to fail when that browser limitation is present.

## Coverage

| Case | Chromium | Firefox |
|---|---:|---:|
| Same-origin and CORS video injection/source preservation | automated | automated |
| Cross-origin iframe (`all_frames`) | automated | automated |
| Dynamic replacement and 20 cleanup cycles | automated | automated |
| Multiple videos and one active WebGPU renderer | automated | automated |
| DOM subtitles and website controls | automated | automated |
| Fullscreen overlay reparenting | automated when Fullscreen API is exposed | automated |
| Navigation and empty-page cleanup | automated | automated |
| Live WebGPU frame processing | automated when `navigator.gpu` is exposed | automated |

The local suite deliberately does not pretend to validate Widevine/Crunchyroll,
Windows Graphics Capture, D3D11 output, monitor switching, audio/video sync over
ten minutes, or black-frame behavior. Those require the native package, a real
protected stream, and manual/hardware acceptance runs. Firefox uses Mozilla's
`web-ext` temporary-addon mechanism and reports results back to the fixture
server; it does not rely on Playwright's unsupported Firefox extension loading.
The localhost command bridge used by the Firefox self-test is compile-time
gated by `ANIME4K_E2E=1`; normal development and release builds do not contain
that bridge.
