#!/usr/bin/env python3
"""Idea 3, honest version: input-identical-frame rate on the real clip.

A tile cache only pays when the INPUT pixels are identical; x264 encodes
every frame with at least luma dithering, so exact byte equality at 8-bit is
the wrong lens. This measures:
  1. exact-equal whole frames (the free win: 0 GPU work),
  2. per-pixel mean abs diff per frame (how far from static the "static"
     scenes actually are),
  3. the share of frames below a small perceptual threshold (abs mean < 0.5
     would still be visually identical after the net).
If (1) is ~0 and (3) small, a cache keyed on exact hashes is dead on real
material and idea 3 gets discarded with numbers instead of hope.
"""
import subprocess
import sys

import numpy as np

CLIP = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/one_piece_clip.mp4"
FRAME_CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 600

probe = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height", "-of", "csv=p=0", CLIP],
    capture_output=True, text=True, check=True)
W, H = map(int, probe.stdout.strip().split(","))

proc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", CLIP, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    stdout=subprocess.PIPE, bufsize=W * H * 4)

prev = None
exact = frames = 0
mean_diffs = []
while frames < FRAME_CAP:
    buf = proc.stdout.read(W * H * 4)
    if len(buf) < W * H * 4:
        break
    cur = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 4)
    if prev is not None:
        if np.array_equal(cur, prev):
            exact += 1
        # mean abs luma-ish diff (all channels fine, video is the signal)
        mean_diffs.append(float(np.abs(cur.astype(np.int16) - prev.astype(np.int16)).mean()))
    prev = cur
    frames += 1
proc.kill()

md = np.array(mean_diffs)
print(f"[clip] {CLIP} {W}x{H}: {frames - 1} frame transitions")
print(f"[1] exactly-identical whole frames: {exact} ({exact / len(md) * 100:.1f}%)")
print(f"[2] mean abs diff per frame: p50={np.percentile(md, 50):.3f} p90={np.percentile(md, 90):.3f}")
for t in (0.1, 0.25, 0.5, 1.0):
    share = (md < t).mean() * 100
    print(f"[3] frames with mean diff < {t}: {share:.1f}%")
