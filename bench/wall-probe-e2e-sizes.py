#!/usr/bin/env python3
"""Targeted native-host wall probe at E2E clip sizes.

Starts the host once, warms up, then reports median HTTP roundtrip ms for
the inference sizes the browser pipeline actually sends (capped clip
geometries) with presentation targets. No Python reference, no giant
frames. Exits 0 when every probed size is under the fps budget.
"""
import statistics
import subprocess
import sys
import time

sys.path.insert(0, "tests")
import importlib.util
spec = importlib.util.spec_from_file_location(
    "t", "tests/host-target-downscale.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

import os
BUDGET_MS = float(os.environ.get("WALL_BUDGET_MS", "66.7"))  # 15 fps
N = 10

# (infer W,H, target W,H, label): capped 4:3 clip geometries + 16:9 cap-mode
SIZES = [
    (640, 480, 2560, 1920, "cap480 full4x-target"),
    (576, 432, 2304, 1728, "cap432"),
    (540, 405, 2160, 1620, "cap405"),
    (480, 360, 1920, 1440, "cap360"),
    (853, 480, 1920, 1080, "cap-mode-16:9-1080p"),
]


def bench(port, token, frame, w, h, tw, th):
    m.http_upscale(port, token, frame, w, h, tw, th)  # warmup
    times = []
    for _ in range(N):
        t0 = time.perf_counter()
        m.http_upscale(port, token, frame, w, h, tw, th)
        times.append((time.perf_counter() - t0) * 1000)
    return statistics.median(times)


def main():
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3,
                        "requestId": "wall-probe"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        print(f"host on 127.0.0.1:{port}, budget {BUDGET_MS:.1f}ms "
              f"({1000.0 / BUDGET_MS:.1f} fps)")
        worst = 0.0
        for (w, h, tw, th, label) in SIZES:
            frame = m.make_frame(w, h)
            med = bench(port, token, frame, w, h, tw, th)
            worst = max(worst, med)
            print(f"{label:22s} {w}x{h} -> {tw}x{th}: "
                  f"{med:7.1f} ms ({1000.0 / med:5.1f} fps)")
        print(f"worst={worst:.1f}ms -> {'PASS' if worst <= BUDGET_MS else 'FAIL'}")
        sys.exit(0 if worst <= BUDGET_MS else 1)
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


if __name__ == "__main__":
    main()
