#!/usr/bin/env python3
"""INT8 vs FP host path comparison (negative result, kept as evidence).

History: per-request `engine=int8` was prototyped in the host (second
co-loaded ncnn net, dispatched by query) and measured on RX 6700 XT / RADV:

  engine=None (fp16 storage): warmed median 22.2 ms
  engine=int8:                warmed median 35.3 ms  (1.6x SLOWER)
  int8-vs-fp PSNR: 30.0 dB, maxabs 185 (visible degradation)

Cause: RDNA2 has no int8 dot-product acceleration; ncnn int8 kernels run
emulated and slower than packed fp16, plus requantize overhead. The host
change was reverted; int8 stays available only via the process-lifetime
--int8 flag (unchanged behavior).

Usage: .venv-realesrgan/bin/python bench/host-int8-vs-fp16.py
Requires: host built WITHOUT changes (this script only uses engine= which
falls back to the default path) — or with the prototype to re-measure.
"""
import importlib.util
import os
import statistics
import subprocess
import sys
import time

import http.client

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, "..", "tests"))
import importlib.util as _ilu

import numpy as np

spec = _ilu.spec_from_file_location(
    "host_target_downscale",
    os.path.join(_HERE, "..", "tests", "host-target-downscale.py"),
)
m = _ilu.module_from_spec(spec)
spec.loader.exec_module(m)

HOST_BIN = os.path.join(_HERE, "..", "native", "linux-host", "build",
                        "aniwebscale-ncnn-host")


def call(port, token, frame, engine):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=120)
    query = f"/upscale?token={token}&w=480&h=360&tw=1280&th=960"
    if engine:
        query += f"&engine={engine}"
    start = time.perf_counter()
    conn.request("POST", query, body=frame,
                 headers={"Content-Type": "text/plain"})
    response = conn.getresponse()
    body = response.read()
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    conn.close()
    return elapsed_ms, body


def main():
    proc = subprocess.Popen([HOST_BIN], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3,
                        "requestId": "int8-vs-fp16"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        frame = m.make_frame(480, 360)
        outputs = {}
        for engine in (None, "int8"):
            times = []
            for i in range(12):
                elapsed_ms, body = call(port, token, frame, engine)
                if i >= 2:
                    times.append(elapsed_ms)
                if i == 11:
                    outputs[engine] = body
            print(f"engine={engine}: warmed median "
                  f"{statistics.median(times):5.1f}ms min {min(times):5.1f}ms")
        base = np.frombuffer(outputs[None], dtype=np.uint8).astype(np.float64)
        cand = np.frombuffer(outputs["int8"], dtype=np.uint8).astype(np.float64)
        mse = ((base - cand) ** 2).mean()
        psnr = 10 * np.log10(255 * 255 / mse) if mse > 0 else float("inf")
        print(f"int8-vs-fp PSNR: {psnr:.2f} dB  "
              f"maxabs={np.abs(base - cand).max():.0f}")
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


if __name__ == "__main__":
    main()
