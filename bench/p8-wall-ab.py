#!/usr/bin/env python3
"""p8 wall A/B: HTTP roundtrip with and without the presentation target.

Cap-mode geometry (what ships): 853x480 input, 1080p presentation target.
Also 1280x720 input for the larger end. Median of N samples, warm host.
Reports payload sizes and wall time deltas.
"""
import importlib.util
import os
import statistics
import subprocess
import time
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

N = 15


def bench(port, token, frame, W, H, tw, th):
    # one warmup
    m.http_upscale(port, token, frame, W, H, tw, th)
    times = []
    last = b""
    for _ in range(N):
        t0 = time.perf_counter()
        out, ow, oh = m.http_upscale(port, token, frame, W, H, tw, th)
        times.append((time.perf_counter() - t0) * 1000)
        last = out
    return statistics.median(times), len(last), (ow, oh)


def main():
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]

        for (W, H, tw, th, label) in [
            (853, 480, 1920, 1080, "cap-mode"),
            (853, 480, 0, 0, "cap-mode-full4x"),
            (1280, 720, 2560, 1440, "720p->1440p"),
            (1280, 720, 0, 0, "720p-full4x"),
        ]:
            frame = m.make_frame(W, H)
            med, nbytes, dims = bench(port, token, frame, W, H, tw, th)
            print(f"{label:16s} {W}x{H} -> {dims[0]}x{dims[1]}: "
                  f"{med:6.1f} ms wall, {nbytes/1e6:5.1f} MB payload")
    finally:
        proc.stdin.close()
        proc.wait(timeout=15)


if __name__ == "__main__":
    main()
