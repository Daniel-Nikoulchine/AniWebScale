#!/usr/bin/env python3
"""Golden test for the p8 presentation-target (tw/th) host path.

Verifies three things against the running aniwebscale-ncnn-host:
  1. Identity: a request WITHOUT tw/th produces the exact same bytes as a
     request with tw/th >= 4x input (no downscale happens either way).
  2. Downscale correctness: with tw/th < 4x (e.g. a 2560x1440 target for a
     640x360 input), the response is target-sized and equals an exact box
     average (fractional edge weights) of the full 4x output, computed here
     in float64 as the reference. The shader computes the average in fp16
     source / fp32 accumulate; allow a small per-channel tolerance (<= 1/255)
     to absorb fp16 storage rounding of the source values.
  3. Tiled path: same checks on a 1920x1080 input (tiled 512/32 + CPU box
     pass) against a 2560x1440 target. Tolerance <= 1/255 as well.

Usage: python3 tests/host-target-downscale.py [path-to-host]
"""
import base64
import json
import socket
import struct
import subprocess
import sys
import time
import urllib.request

import numpy as np

HOST = sys.argv[1] if len(sys.argv) > 1 else "native/linux-host/build/aniwebscale-ncnn-host"


def framed(proc, obj):
    data = json.dumps(obj).encode()
    proc.stdin.write(struct.pack("<I", len(data)) + data)
    proc.stdin.flush()


def read_framed(stream):
    header = b""
    while len(header) < 4:
        chunk = stream.read(4 - len(header))
        if not chunk:
            raise RuntimeError("host closed stdout")
        header += chunk
    (length,) = struct.unpack("<I", header)
    data = b""
    while len(data) < length:
        chunk = stream.read(length - len(data))
        if not chunk:
            raise RuntimeError("host closed stdout mid-message")
        data += chunk
    return json.loads(data)


def make_frame(w, h, salt=0):
    x = np.arange(w, dtype=np.int64)
    y = np.arange(h, dtype=np.int64)[:, None]
    frame = np.empty((h, w, 4), dtype=np.uint8)
    frame[..., 0] = (x * 3 + salt) & 0xFF
    frame[..., 1] = (y * 5 + salt) & 0xFF
    frame[..., 2] = ((x + y) * 7 + salt) & 0xFF
    frame[..., 3] = 255
    return frame.tobytes()


def http_upscale(port, token, frame, w, h, tw=0, th=0):
    query = f"token={token}&w={w}&h={h}"
    if tw and th:
        query += f"&tw={tw}&th={th}"
    url = f"http://127.0.0.1:{port}/upscale?{query}"
    req = urllib.request.Request(url, data=frame, method="POST",
                                 headers={"Content-Type": "text/plain"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        out = resp.read()
        out_w = int(resp.headers["X-Frame-Width"])
        out_h = int(resp.headers["X-Frame-Height"])
    return out, out_w, out_h


def box_average_reference(rgba, src_w, src_h, dst_w, dst_h):
    """Exact box average with fractional edge weights (float64 reference)."""
    src = np.frombuffer(rgba, dtype=np.uint8).reshape(src_h, src_w, 4).astype(np.float64)
    out = np.empty((dst_h, dst_w, 4), dtype=np.uint8)
    for y in range(dst_h):
        y0f = y * src_h / dst_h
        y1f = (y + 1) * src_h / dst_h
        y0, y1 = int(np.floor(y0f)), int(np.ceil(y1f))
        for x in range(dst_w):
            x0f = x * src_w / dst_w
            x1f = (x + 1) * src_w / dst_w
            x0, x1 = int(np.floor(x0f)), int(np.ceil(x1f))
            acc = np.zeros(3)
            wsum = 0.0
            for sy in range(y0, y1):
                wy = min(y1f, sy + 1) - max(y0f, sy)
                if wy <= 0:
                    continue
                for sx in range(x0, x1):
                    wx = min(x1f, sx + 1) - max(x0f, sx)
                    if wx <= 0:
                        continue
                    acc += src[sy, sx, :3] * (wx * wy)
                    wsum += wx * wy
            out[y, x, :3] = np.floor(acc / wsum + 0.5)
            out[y, x, 3] = 255
    return out.tobytes()


def max_channel_diff(a, b):
    A = np.frombuffer(a, dtype=np.uint8).astype(np.int16)
    B = np.frombuffer(b, dtype=np.uint8).astype(np.int16)
    return int(np.abs(A - B).max())


def main():
    proc = subprocess.Popen([HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    try:
        framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
        hello = read_framed(proc.stdout)
        port = int(hello["httpPort"])
        token = hello["httpToken"]

        # ---------- single-pass path: 640x360 -> target 2560x1440 ----------
        W, H = 640, 360
        frame = make_frame(W, H)
        full, fw, fh = http_upscale(port, token, frame, W, H)
        assert (fw, fh) == (2560, 1440), (fw, fh)
        print(f"[test] full 4x: {fw}x{fh} {len(full)} bytes")

        ident, iw, ih = http_upscale(port, token, frame, W, H, 2560, 1440)
        assert (iw, ih) == (2560, 1440) and ident == full, "tw/th at >=4x must be identity"
        print("[test] PASS identity: tw/th >= 4x returns the identical full frame")

        TW, TH = 1920, 1080
        small, sw, sh = http_upscale(port, token, frame, W, H, TW, TH)
        assert (sw, sh) == (TW, TH), (sw, sh)
        assert len(small) == TW * TH * 4
        print(f"[test] downscale: {sw}x{sh} {len(small)} bytes "
              f"({100 * len(small) / len(full):.0f}% of full payload)")
        ref = box_average_reference(full, fw, fh, TW, TH)
        diff = max_channel_diff(small, ref)
        print(f"[test] single-pass box diff vs reference: {diff}/255")
        assert diff <= 1, f"downscale differs from box reference by {diff}"

        # Non-integer ratio (2560x1440 -> 1707x960 target) exercises the
        # fractional-weight edges.
        TW2, TH2 = 1707, 960
        small2, sw2, sh2 = http_upscale(port, token, frame, W, H, TW2, TH2)
        assert (sw2, sh2) == (TW2, TH2)
        ref2 = box_average_reference(full, fw, fh, TW2, TH2)
        diff2 = max_channel_diff(small2, ref2)
        print(f"[test] fractional-ratio box diff vs reference: {diff2}/255")
        assert diff2 <= 1, f"fractional downscale differs by {diff2}"

        # ---------- tiled path: 1920x1080 input, 2560x1440 target ----------
        W2, H2 = 1920, 1080
        big_frame = make_frame(W2, H2, salt=7)
        full_big, fbw, fbh = http_upscale(port, token, big_frame, W2, H2)
        assert (fbw, fbh) == (7680, 4320)
        small_big, sbw, sbh = http_upscale(port, token, big_frame, W2, H2, 2560, 1440)
        assert (sbw, sbh) == (2560, 1440)
        print(f"[test] tiled downscale: 7680x4320 -> {sbw}x{sbh} "
              f"({100 * len(small_big) / len(full_big):.0f}% of full payload)")
        ref_big = box_average_reference(full_big, fbw, fbh, 2560, 1440)
        diff_big = max_channel_diff(small_big, ref_big)
        print(f"[test] tiled box diff vs reference: {diff_big}/255")
        assert diff_big <= 1, f"tiled downscale differs from box reference by {diff_big}"

        print("[test] ALL PASS")
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)
        err = proc.stderr.read().decode(errors="replace")
        print("[host stderr]", "\n[host stderr] ".join(err.strip().splitlines()[-6:]))


if __name__ == "__main__":
    main()
