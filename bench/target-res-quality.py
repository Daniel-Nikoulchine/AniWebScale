#!/usr/bin/env python3
"""Stufe 1 Quality-Gate: Infer-at-Target-Res vs Voll-4x-then-Downscale.

Referenz: Voll-4x-Dump (erster Case, z.B. 640x360 -> 2560x1440 raw RGBA),
per exaktem Box-Average (fraktionale Kantengewichte, float64) auf Case-Groesse
(640x360) runterskaliert.
Kandidat: --infer-at-target-Dump (direkt 640x360 raw RGBA).
Metrik: PSNR ueber RGB. Gate: >= 30 dB (Enhancement bleibt, Detailverlust
begrenzt; Schwellwert aus cap-quality-360-Praezedenz 35 dB abgeleitet,
fuer 16x weniger Netz-Pixel bewusst looser).

Usage:
  target-res-quality.py FULL.raw FULL_W FULL_H TARGET.raw TARGET_W TARGET_H
"""
import math
import sys

import numpy as np


def box_downscale(frame, tw, th):
    ch, cw, _ = frame.shape
    out = np.empty((th, tw, 4), dtype=np.float64)
    for y in range(th):
        y0f = y * ch / th
        y1f = (y + 1) * ch / th
        y0, y1 = int(math.floor(y0f)), int(math.ceil(y1f))
        for x in range(tw):
            x0f = x * cw / tw
            x1f = (x + 1) * cw / tw
            x0, x1 = int(math.floor(x0f)), int(math.ceil(x1f))
            ar = ag = ab = wsum = 0.0
            for sy in range(y0, y1):
                wy = min(y1f, sy + 1) - max(y0f, sy)
                if wy <= 0:
                    continue
                for sx in range(x0, x1):
                    wx = min(x1f, sx + 1) - max(x0f, sx)
                    if wx <= 0:
                        continue
                    w = wx * wy
                    p = frame[sy, sx]
                    ar += float(p[0]) * w
                    ag += float(p[1]) * w
                    ab += float(p[2]) * w
                    wsum += w
            inv = 1.0 / max(wsum, 1e-9)
            out[y, x] = (ar * inv, ag * inv, ab * inv, 255.0)
    return out


def psnr(a, b):
    a = a.astype(np.float64)[..., :3]
    b = b.astype(np.float64)[..., :3]
    mse = float(np.mean((a - b) ** 2))
    return 100.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def main():
    if len(sys.argv) != 7:
        print(__doc__)
        return 2
    full_path, fw, fh, tgt_path, tw, th = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5]), int(sys.argv[6])
    full = np.fromfile(full_path, dtype=np.uint8).reshape(fh, fw, 4).astype(np.float64)
    tgt = np.fromfile(tgt_path, dtype=np.uint8).reshape(th, tw, 4).astype(np.float64)
    ref = box_downscale(full, tw, th)
    p = psnr(ref, tgt)
    print(f"PSNR infer-at-target vs full-4x-downscaled: {p:.2f} dB (gate >= 30 dB)")
    print("QUALITY-GATE:", "PASS" if p >= 30.0 else "FAIL")
    return 0 if p >= 30.0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
