#!/usr/bin/env python3
"""Diagnose WHERE the box-downscale diff comes from.

Runs three probe requests against the host:
  A) tw=2560 th=1080  -> y-axis-only downscale
  B) tw=1280 th=1440  -> x-axis-only, integer 2:1
  C) tw=1920 th=1080  -> both axes, 4:3

For each, computes the box reference from the full 4x frame and reports
where the max diff sits (wrap columns x*3&0xFF wrap every ~85px, frame
borders, or everywhere) plus the fraction of pixels over tolerance.
"""
import struct
import subprocess
import sys
import urllib.request

import numpy as np

import importlib.util
import os

_MODULE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "tests", "host-target-downscale.py"
)
_spec = importlib.util.spec_from_file_location("host_target_downscale", _MODULE_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
framed = _mod.framed
read_framed = _mod.read_framed
make_frame = _mod.make_frame
http_upscale = _mod.http_upscale
box_average_reference = _mod.box_average_reference


def diff_stats(small, ref, src_w, src_h, tw, th):
    A = np.frombuffer(small, dtype=np.uint8).reshape(th, tw, 4).astype(np.int16)
    B = np.frombuffer(ref, dtype=np.uint8).reshape(th, tw, 4).astype(np.int16)
    D = np.abs(A - B).max(axis=2)
    print(f"    max={D.max()}  >1: {(D > 1).mean() * 100:.2f}%  >2: {(D > 2).mean() * 100:.2f}%  "
          f">5: {(D > 5).mean() * 100:.3f}%")
    # Where are the worst pixels?
    ys, xs = np.unravel_index(np.argsort(D, axis=None)[::-1][:2000], D.shape)
    xs_u = np.unique(xs)
    ys_u = np.unique(ys)
    print(f"    worst-pixel x range: {xs_u.min()}..{xs_u.max()}  (unique {len(xs_u)})")
    print(f"    worst-pixel y range: {ys_u.min()}..{ys_u.max()}  (unique {len(ys_u)})")
    # Wrap columns in the SOURCE are at src_x where (src_x*3)&0xFF wraps,
    # i.e. src_x = 85, 170, ... ; output columns x map to src [x*src_w/tw, ...)
    scale = src_w / tw
    wrap_src = np.array([85 * k for k in range(1, src_w // 85)])
    near_wrap = np.zeros(len(xs), dtype=bool)
    for i, x in enumerate(xs):
        sx = x * scale
        near_wrap[i] = np.any((wrap_src >= sx - 3) & (wrap_src <= sx + scale + 3))
    print(f"    worst pixels near src-wrap columns: {near_wrap.mean() * 100:.0f}%")
    # Border proximity
    border = (xs < 8) | (xs > tw - 9) | (ys < 8) | (ys > th - 9)
    print(f"    worst pixels at frame border: {border.mean() * 100:.0f}%")


def main():
    proc = subprocess.Popen(
        ["native/linux-host/build/aniwebscale-ncnn-host"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
        hello = read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]

        W, H = 640, 360
        frame = make_frame(W, H)
        full, fw, fh = http_upscale(port, token, frame, W, H)
        print(f"full: {fw}x{fh}")

        for tw, th, label in [
            (2560, 1080, "A: y-only 1440->1080"),
            (1280, 1440, "B: x-only integer 2:1"),
            (1920, 1080, "C: both 4:3"),
        ]:
            small, sw, sh = http_upscale(port, token, frame, W, H, tw, th)
            ref = box_average_reference(full, fw, fh, tw, th)
            print(f"  {label}: {sw}x{sh}")
            diff_stats(small, ref, fw, fh, tw, th)
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


if __name__ == "__main__":
    main()
