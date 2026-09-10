# Linux ncnn-Vulkan native host

The optional Linux counterpart to the Windows renderer: a small native process
that runs the RealESRGAN AnimeVideo-v3 x4 network (and the experimental
hand-written SRVGG backend) on Vulkan, driven by the extension through a
token-authenticated loopback HTTP transport.

The extension reaches it through `chrome.runtime.connectNative` (hello/ready)
and then ships frames directly to `http://127.0.0.1:<port>/upscale`, so no
multi-megabyte frame travels through the Native Messaging pipe. The host is a
process-lifetime singleton: it exits after an idle timeout and the browser
re-spawns it on the next frame.

## Build

Dependencies: CMake ≥ 3.25, a C++20 compiler, Vulkan (loader + headers),
`glslangValidator`, and the pinned ncnn tree.

```bash
python3 native/spike/fetch-sources.py           # ncnn + glslang (pinned)
cmake -S native/linux-host -B native/linux-host/build -G Ninja
cmake --build native/linux-host/build --target aniwebscale-ncnn-host -j"$(nproc)"
bash native/scripts/install-linux-host.sh       # writes the native-messaging manifest
```

`mimalloc` is linked automatically when present (`pacman -S mimalloc`);
otherwise the host builds without it.

## Run

```text
aniwebscale-ncnn-host [--param FILE] [--bin FILE] [--fp16 | --no-fp16]
                      [--int8 --int8-param FILE --int8-bin FILE]
                      [--idle-timeout SECS] [--traffic-test W H [ITERS]]
```

With no arguments it loads the bundled
`models/realesrgan/ncnn/realesr-animevideov3-x4.param/.bin` and serves the
framed JSON protocol on stdin/stdout plus the HTTP transport. Set
`ANIWEBSCALE_NO_WARMUP=1` to skip the two-frame session warmup (used by
`--traffic-test`, which measures a cold 64-channel layer boundary and exits).

## Precisions

- **fp16 storage (default).** The network, GPU preproc and GPU postproc run
  with 16-bit channels. This is the realtime path (~15 fps at the 480p cap on
  an RX 6750 XT).
- **fp32 storage (`--no-fp16` / `ANIWEBSCALE_NO_FP16=1`).** 32-bit channels
  end to end via `realesrgan_spike_preproc_f32` / `realesrgan_spike_postproc_f32`.
  Numerically exact but ~2.5x slower. The **fp32 governor** reduces the
  inference scale per frame (fractional CPU box downsample) to fit a net-time
  budget and lets the fp32 postproc bilinear-upscale to the presentation
  target, so the frame stays inside the 15 fps wall-probe budget. The quality
  cost is a lower effective inference resolution; see the evidence script
  below.
- **INT8** is a separate quantized model (`--int8 --int8-param …`), generated
  by `native/spike/calibrate-ncnn-int8.sh`.

The hand-written SRVGG backend (`ANIWEBSCALE_SRVGG_ENGINE=1`) is fp16-only and
is disabled in fp32-storage mode.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `ANIWEBSCALE_NO_FP16=1` | Select true fp32 storage (see above). |
| `ANIWEBSCALE_FP32_BUDGET_MS` | fp32 governor net budget in ms (default `44`; `0` disables it → full-resolution fp32). |
| `ANIWEBSCALE_FP32_MS_PER_PX` | Governor cost model, ms per input pixel (default `3.0e-4`). |
| `ANIWEBSCALE_FP32_MIN_SCALE` | Lowest inference scale the governor may pick (default `0.5`). |
| `ANIWEBSCALE_INFER_DIV=2` | Infer at half resolution and let the postproc scale to the target. |
| `ANIWEBSCALE_NCNN_PARAM` / `_BIN` | Override the network files. |
| `ANIWEBSCALE_NCNN_INT8_PARAM` / `_BIN` | INT8 model files. |
| `ANIWEBSCALE_SRVGG_ENGINE=1` | Enable the hand-written SRVGG backend. |
| `ANIWEBSCALE_HOST_IDLE_TIMEOUT_S` | Idle-exit timeout in seconds (default `90`, `0` disables). |
| `ANIWEBSCALE_NO_WARMUP=1` | Skip the session warmup. |

## Pipeline

RGBA8 upload → GPU preproc (packed RGBA8 → planar RGB, 16- or 32-bit) → ncnn
net (or SRVGG) → GPU postproc (planar → RGBA8; identity, box-downscale or
bilinear-upscale to the presentation target `tw`/`th`) → zero-copy download.
Frames whose inference exceeds 1280×720 are tiled (tile 642, halo 33); when the
presentation target is an exact integer shrink of the 4x output, each tile is
box-downscaled on the GPU and stitched, otherwise the host composes the full 4x
frame and runs a parallelized CPU box pass.

## Verification

```bash
python3 tests/host-target-downscale.py                       # fp16: identity + box + tiled + per-tile GPU
ANIWEBSCALE_NO_FP16=1 ANIWEBSCALE_FP32_BUDGET_MS=0 \
  python3 tests/host-target-downscale.py                     # fp32 shaders, bit-exact
python3 tests/host-http-transport.py                         # HTTP vs stdin byte-identical
python3 bench/host-latency-bench.py --cases 853x480,960x540  # round-trip latency
ANIWEBSCALE_NO_FP16=1 python3 bench/wall-probe-e2e-sizes.py  # 15 fps budget, all capped geometries
```

`bench/native-fp32-governor-evidence.py` measures all three modes (fp16,
full-fp32, fp32-governor) plus PSNR/SSIM of the governed output against the
full-fp32 reference and writes `artifacts/ncnn-fp32-governor-evidence.json`.

For the isolated GPU benchmark (no browser, no HTTP) use
`native/linux-host/run-benchmark.sh` or `npm run bench:ncnn`; the result is
written to `artifacts/ncnn-vulkan-rx6750xt-benchmark.json`.
