#!/usr/bin/env python3
"""Quality evidence for a 360p auto-cap rung (host-side, no browser).

Compares PRESENTED outputs (1280x960, the E2E presentation target) for
inference at 480/405/360p heights on real anime frames from the E2E clip.
Verdict: the 360 rung is justified when 360-vs-405 PSNR is no worse than
the 405-vs-480 step auto-cap already takes today (>= ~35 dB both).
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
# Diverse timestamps: bright, action, dark.
STAMPS = ["5", "25", "45"]
# (infer W,H) for cap heights on the 4:3 clip + presentation target.
CAPS = [(640, 480, "480"), (540, 405, "405"), (480, 360, "360")]
TW, TH = 1280, 960


def extract_frame(stamp):
    out = os.path.join("/tmp", f"capq-{stamp}.raw")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", stamp, "-i", CLIP,
                    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba",
                    out], check=True)
    return np.fromfile(out, dtype=np.uint8).reshape(480, 640, 4)


def downscale_rgba(frame, w, h):
    # Area-ish downscale via PIL if present, else nearest (rank-preserving).
    try:
        from PIL import Image
        img = Image.fromarray(frame, "RGBA").resize((w, h), Image.BILINEAR)
        return np.asarray(img)
    except ImportError:
        ys = (np.arange(h) * frame.shape[0] // h)
        xs = (np.arange(w) * frame.shape[1] // w)
        return frame[ys][:, xs]


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
                        "requestId": "cap-quality"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        results = {c[2]: [] for c in CAPS}
        for stamp in STAMPS:
            full = extract_frame(stamp)
            outs = {}
            for (w, h, label) in CAPS:
                small = downscale_rgba(full, w, h)
                out, ow, oh = m.http_upscale(
                    port, token, small.tobytes(), w, h, TW, TH)
                assert (ow, oh) == (TW, TH), (ow, oh)
                outs[label] = np.frombuffer(out, dtype=np.uint8
                                            ).reshape(TH, TW, 4)
            p480_405 = psnr(outs["480"], outs["405"])
            p405_360 = psnr(outs["405"], outs["360"])
            p480_360 = psnr(outs["480"], outs["360"])
            print(f"t={stamp}s 480-vs-405 {p480_405:5.2f} dB  "
                  f"405-vs-360 {p405_360:5.2f} dB  480-vs-360 {p480_360:5.2f} dB")
            results["405"].append(p480_405)
            results["360"].append(p405_360)
        mean = lambda xs: sum(xs) / len(xs)
        print(f"mean 480-vs-405 {mean(results['405']):.2f} dB, "
              f"mean 405-vs-360 {mean(results['360']):.2f} dB")
        ok = (mean(results["360"]) >= 35.0
              and mean(results["360"]) >= mean(results["405"]) - 3.0)
        print("cap360 rung:", "JUSTIFIED" if ok else "REJECTED")
        sys.exit(0 if ok else 1)
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


if __name__ == "__main__":
    main()
