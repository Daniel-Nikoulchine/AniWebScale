#!/usr/bin/env python3
"""Native fp32-storage governor evidence.

Runs the real Linux ncnn host in three modes over the E2E capped geometries
and writes a JSON report:

  - fp16        : default host (fp16 storage, fp32 arithmetic) — reference speed
  - fp32-full   : true fp32 storage, governor disabled (quality reference)
  - fp32-gov    : true fp32 storage + inference-scale governor (15 fps budget)

For every mode/case it records the HTTP roundtrip stats (mean/p50/p95/max) and
the returned frame size. It also measures PSNR/SSIM of the fp32-governed and
fp16 outputs against the full-fp32 reference on a real frame.

Usage: .venv-realesrgan/bin/python bench/native-fp32-governor-evidence.py \
         [--samples N] [--out artifacts/...json]
"""
import argparse
import importlib.util
import json
import math
import os
import statistics
import subprocess
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HOST = os.path.join(ROOT, "native/linux-host/build/aniwebscale-ncnn-host")
FRAME = os.path.join(ROOT, "tests/fixtures/one_piece_clip.mp4")
BUDGET_MS = 66.7  # 15 fps

# (infer W, H, target W, H, label) — the capped clip geometries the browser sends
SIZES = [
    (640, 480, 2560, 1920, "cap480-4:3-full4x"),
    (576, 432, 2304, 1728, "cap432-full4x"),
    (540, 405, 2160, 1620, "cap405-full4x"),
    (480, 360, 1920, 1440, "cap360-full4x"),
    (853, 480, 1920, 1080, "cap480-16:9->1080p"),
]

MODES = {
    "fp16": {},
    "fp32-full": {"ANIWEBSCALE_NO_FP16": "1", "ANIWEBSCALE_FP32_BUDGET_MS": "0"},
    "fp32-gov": {"ANIWEBSCALE_NO_FP16": "1"},
}


def load_host_helpers():
    spec = importlib.util.spec_from_file_location(
        "hosthelpers", os.path.join(ROOT, "tests/host-target-downscale.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def start_host(mod, env):
    e = dict(os.environ)
    e.update(env)
    proc = subprocess.Popen([HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, env=e)
    mod.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "evidence"})
    hello = mod.read_framed(proc.stdout)
    return proc, int(hello["httpPort"]), hello["httpToken"]


def bench_mode(mod, env, samples):
    proc, port, token = start_host(mod, env)
    results = []
    try:
        for (w, h, tw, th, label) in SIZES:
            frame = mod.make_frame(w, h)
            for _ in range(3):
                mod.http_upscale(port, token, frame, w, h, tw, th)
            times = []
            size = None
            for _ in range(samples):
                t0 = time.perf_counter()
                _out, ow, oh = mod.http_upscale(port, token, frame, w, h, tw, th)
                times.append((time.perf_counter() - t0) * 1000.0)
                size = (ow, oh)
            ordered = sorted(times)
            results.append({
                "label": label,
                "width": w, "height": h, "targetWidth": tw, "targetHeight": th,
                "outWidth": size[0], "outHeight": size[1],
                "sizeMatchesTarget": size == (tw, th),
                "meanMs": statistics.mean(times),
                "p50Ms": statistics.median(times),
                "p95Ms": ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))],
                "maxMs": ordered[-1],
                "fps": 1000.0 / statistics.mean(times),
            })
    finally:
        proc.stdin.close()
        proc.wait(timeout=15)
    return results


def frame_rgba(w, h):
    # Real anime frame from the E2E clip, resized to the inference geometry.
    import subprocess as sp
    png = "/tmp/fp32-evidence-frame.png"
    if not os.path.exists(png):
        sp.run(["ffmpeg", "-y", "-v", "error", "-ss", "3", "-i", FRAME,
                "-frames:v", "1", png], check=True)
    img = Image.open(png).convert("RGBA")
    return np.asarray(img.resize((w, h), Image.LANCZOS), dtype=np.uint8)


def quality_case(mod, env, w, h, tw, th):
    proc, port, token = start_host(mod, env)
    try:
        rgba = frame_rgba(w, h)
        import urllib.request
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/upscale?token={token}&w={w}&h={h}&tw={tw}&th={th}",
            data=rgba.tobytes(), method="POST", headers={"Content-Type": "text/plain"})
        with urllib.request.urlopen(req, timeout=180) as resp:
            out = np.frombuffer(resp.read(), dtype=np.uint8)
            ow = int(resp.headers["X-Frame-Width"])
            oh = int(resp.headers["X-Frame-Height"])
        return out.reshape(oh, ow, 4)
    finally:
        proc.stdin.close()
        proc.wait(timeout=15)


def psnr(a, b):
    mse = np.mean((a[..., :3].astype(np.float64) - b[..., :3].astype(np.float64)) ** 2)
    return 99.0 if mse == 0 else 10.0 * math.log10(255.0 * 255.0 / mse)


def ssim(a, b):
    a = a[..., :3].astype(np.float64).mean(axis=2)
    b = b[..., :3].astype(np.float64).mean(axis=2)
    mu_a, mu_b = a.mean(), b.mean()
    va, vb = a.var(), b.var()
    cov = ((a - mu_a) * (b - mu_b)).mean()
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    return ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a ** 2 + mu_b ** 2 + c1) * (va + vb + c2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", type=int, default=30)
    ap.add_argument("--out", default=os.path.join(ROOT, "artifacts/ncnn-fp32-governor-evidence.json"))
    args = ap.parse_args()

    mod = load_host_helpers()
    report = {"tool": "native-fp32-governor-evidence", "budgetMs": BUDGET_MS,
              "samples": args.samples, "device": "AMD Radeon RX 6750 XT (RADV NAVI22)",
              "modes": {}}
    for mode, env in MODES.items():
        report["modes"][mode] = bench_mode(mod, env, args.samples)
        worst = max(r["p95Ms"] for r in report["modes"][mode])
        print(f"[{mode}] worst p95 {worst:.1f}ms -> {'PASS' if worst <= BUDGET_MS else 'FAIL'}")
        for r in report["modes"][mode]:
            print(f"  {r['label']:22s} mean {r['meanMs']:6.1f} p95 {r['p95Ms']:6.1f} "
                  f"fps {r['fps']:5.1f} size {'ok' if r['sizeMatchesTarget'] else 'MISMATCH'}")

    # Quality: fp32-gov and fp16 against the full-fp32 reference.
    report["quality"] = []
    for (w, h, tw, th, label) in SIZES:
        ref = quality_case(mod, MODES["fp32-full"], w, h, tw, th)
        gov = quality_case(mod, MODES["fp32-gov"], w, h, tw, th)
        fp16 = quality_case(mod, MODES["fp16"], w, h, tw, th)
        entry = {
            "label": label, "width": w, "height": h, "targetWidth": tw, "targetHeight": th,
            "govSizeMatches": gov.shape[:2] == (th, tw),
            "psnrGovVsFullFp32": psnr(gov, ref),
            "ssimGovVsFullFp32": ssim(gov, ref),
            "psnrFp16VsFullFp32": psnr(fp16, ref),
            "ssimFp16VsFullFp32": ssim(fp16, ref),
        }
        report["quality"].append(entry)
        print(f"[quality] {label:22s} gov {entry['psnrGovVsFullFp32']:5.1f}dB "
              f"(ssim {entry['ssimGovVsFullFp32']:.4f})  fp16 {entry['psnrFp16VsFullFp32']:5.1f}dB "
              f"(ssim {entry['ssimFp16VsFullFp32']:.4f})")

    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[evidence] wrote {args.out}")


if __name__ == "__main__":
    main()
