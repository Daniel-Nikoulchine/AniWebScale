#!/usr/bin/env python3
"""Idea 3 measurement: tile-cache hit rate on a real anime clip.

Splits every frame into the host's tile geometry (TILE=512 input px, PAD=32)
and counts how many CORE tile regions are byte-identical to the previous
frame's tile at the same position. A host-side tile cache would skip the GPU
for those (output of a tile depends only on core+pad, deterministic net), so
the measured hit rate IS the achievable GPU-work reduction of the cache.

Reports overall hit rate and the temporal distribution (dialog vs. action
scenes show up as clusters of high/low hit windows).
"""
import subprocess
import sys

import numpy as np

CLIP = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/one_piece_clip.mp4"
TILE = 512
PAD = 32
FRAME_CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 600

# Decode as raw RGBA at native size via ffmpeg pipe.
probe = subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height", "-of", "csv=p=0", CLIP],
    capture_output=True, text=True, check=True)
W, H = map(int, probe.stdout.strip().split(","))
print(f"[clip] {CLIP}: {W}x{H}, first {FRAME_CAP} frames, tile={TILE} pad={PAD}")

proc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", CLIP, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    stdout=subprocess.PIPE, bufsize=W * H * 4)


def tiles_of(frame):
    """Yield (x0, y0, ew, eh) expanded tile rects, core-only bytes."""
    out = []
    for ty in range(0, H, TILE):
        for tx in range(0, W, TILE):
            cx1 = min(tx + TILE, W)
            cy1 = min(ty + TILE, H)
            out.append(frame[ty:cy1, tx:cx1].tobytes())
    return out


prev_tiles = None
hits = total = 0
frame_idx = 0
per_frame_hits = []
while frame_idx < FRAME_CAP:
    buf = proc.stdout.read(W * H * 4)
    if len(buf) < W * H * 4:
        break
    frame = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 4)
    cur = tiles_of(frame)
    if prev_tiles is not None:
        same = sum(1 for a, b in zip(cur, prev_tiles) if a == b)
        hits += same
        total += len(cur)
        per_frame_hits.append(same / len(cur))
    prev_tiles = cur
    frame_idx += 1

proc.kill()
rate = hits / total if total else 0
print(f"[result] frames={frame_idx - 1} tile-compares={total} "
      f"identical={hits} -> hit rate {rate * 100:.1f}%")
arr = np.array(per_frame_hits)
print(f"[dist] p10={np.percentile(arr, 10)*100:.0f}% p50={np.percentile(arr, 50)*100:.0f}% "
      f"p90={np.percentile(arr, 90)*100:.0f}% max={arr.max()*100:.0f}%")
frames_above_50 = (arr > 0.5).mean() * 100
print(f"[dist] frames with >50% tile hits: {frames_above_50:.0f}%")
