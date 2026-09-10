#!/usr/bin/env python3
"""Host concurrency tax probe: sequential vs N-concurrent requests.

Decides whether E2E's ~100ms effective host service is host-side collapse
under concurrency (fix in host) or browser-fetch-path overhead (fix in
client). No browser involved.
"""
import concurrent.futures
import importlib.util
import os
import statistics
import subprocess
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

W, H, TW, TH = 480, 360, 1280, 960
N = 12


def seq(port, token, frame):
    m.http_upscale(port, token, frame, W, H, TW, TH)  # warmup
    times = []
    for _ in range(N):
        t0 = time.perf_counter()
        m.http_upscale(port, token, frame, W, H, TW, TH)
        times.append((time.perf_counter() - t0) * 1000)
    return times


def conc(port, token, frame, workers):
    m.http_upscale(port, token, frame, W, H, TW, TH)  # warmup
    def one(_):
        t0 = time.perf_counter()
        m.http_upscale(port, token, frame, W, H, TW, TH)
        return (time.perf_counter() - t0) * 1000
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        return sorted(ex.map(one, range(N)))


def main():
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3,
                        "requestId": "conc-probe"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        frame = m.make_frame(W, H)
        s = seq(port, token, frame)
        print(f"sequential:       median {statistics.median(s):6.1f} ms "
              f"p90 {sorted(s)[int(N * 0.9) - 1]:6.1f} ms")
        for workers in (2, 3, 4):
            c = conc(port, token, frame, workers)
            # Throughput view: N requests, makespan-equivalent per completion.
            print(f"concurrent x{workers}:    per-req median {statistics.median(c):6.1f} ms "
                  f"p90 {c[int(N * 0.9) - 1]:6.1f} ms  "
                  f"-> max {1000.0 / statistics.median(c) * workers:5.1f} fps iff parallel")
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)


if __name__ == "__main__":
    main()
