#!/usr/bin/env python3
"""Probe: First-Frame-Latenz vs Steady-State (Host frisch gespawnt)."""
import importlib.util
import os
import subprocess
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

W, H = 640, 360
frame = m.make_frame(W, H)
proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
try:
    m.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "w"})
    hello = m.read_framed(proc.stdout)
    port, token = int(hello["httpPort"]), hello["httpToken"]
    for i in range(4):
        t0 = time.time()
        out, ow, oh = m.http_upscale(port, token, frame, W, H, W, H)
        dt = (time.time() - t0) * 1000
        assert (ow, oh) == (W, H), (ow, oh)
        print(f"frame{i}: {dt:.1f} ms", flush=True)
finally:
    proc.stdin.close()
    proc.wait(timeout=20)
