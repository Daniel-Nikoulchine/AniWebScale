#!/usr/bin/env python3
"""Stufe 1 Quality-Gate auf Real-Frames (E2E-Clip, Host-seitig, kein Browser).

Vergleicht PRESENTED Outputs (640x480 = 1x Presentation des 4:3-Clips):
  voll : infer 640x480  -> 2560x1920 -> GPU-down 640x480 (p8-Pfad, Bestand)
  div2 : PIL-down 320x240 -> infer -> 1280x960 -> GPU-down 640x480 (4x weniger)
  div4 : PIL-down 160x120 -> infer -> 640x480 direkt (16x weniger, infer-at-target)
Metrik: PSNR (RGB) div vs voll. Gate: >= 30 dB.
Methodik folgt bench/cap-quality-360.py (3 diverse Stamps).
"""
import importlib.util
import math
import os
import subprocess
import sys

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

CLIP = os.path.join(_HERE, "..", "tests", "fixtures", "one_piece_clip.mp4")
STAMPS = ["5", "25", "45"]
W, H = 640, 480  # Clip-Nativ
TW, TH = 640, 480  # 1x Presentation
DIVS = [(1, "voll"), (2, "div2"), (4, "div4")]
GATE_DB = 30.0


def extract_frame(stamp):
    out = os.path.join("/tmp", f"t1-{stamp}.raw")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", stamp, "-i", CLIP,
                    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba",
                    out], check=True)
    return np.fromfile(out, dtype=np.uint8).reshape(H, W, 4)


def downscale(frame, w, h):
    from PIL import Image
    return np.asarray(Image.fromarray(frame, "RGBA").resize((w, h), Image.BILINEAR))


def psnr(a, b):
    a = a.astype(np.float64)[..., :3]
    b = b.astype(np.float64)[..., :3]
    mse = float(np.mean((a - b) ** 2))
    return 100.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def main():
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3,
                        "requestId": "target-res-quality"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        ps = {label: [] for _, label in DIVS[1:]}
        for stamp in STAMPS:
            full = extract_frame(stamp)
            outs = {}
            for div, label in DIVS:
                small = full if div == 1 else downscale(full, W // div, H // div)
                out, ow, oh = m.http_upscale(
                    port, token, small.tobytes(), W // div, H // div, TW, TH)
                assert (ow, oh) == (TW, TH), (ow, oh)
                outs[label] = np.frombuffer(out, dtype=np.uint8).reshape(TH, TW, 4)
            line = f"t={stamp}s "
            for _, label in DIVS[1:]:
                p = psnr(outs["voll"], outs[label])
                ps[label].append(p)
                line += f"voll-vs-{label} {p:5.2f} dB  "
            print(line)
        ok = True
        for _, label in DIVS[1:]:
            mean = sum(ps[label]) / len(ps[label])
            passed = mean >= GATE_DB
            ok &= passed
            print(f"mean voll-vs-{label} {mean:.2f} dB  gate>={GATE_DB}: "
                  f"{'PASS' if passed else 'FAIL'}")
        print("QUALITY-GATE:", "PASS" if ok else "FAIL")
        return 0 if ok else 1
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


if __name__ == "__main__":
    raise SystemExit(main())
