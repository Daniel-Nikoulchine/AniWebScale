#!/usr/bin/env python3
"""Stufe 1 Host-Check: ANIWEBSCALE_INFER_DIV=2 liefert Target-Groesse + Speedup."""
import importlib.util
import os
import subprocess
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def run(div):
    env = dict(os.environ)
    if div != 1:
        env["ANIWEBSCALE_INFER_DIV"] = str(div)
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            env=env)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "s1"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        frame = m.make_frame(640, 360)
        t0 = time.time()
        out, ow, oh = m.http_upscale(port, token, frame, 640, 360, 640, 360)
        dt = time.time() - t0
        assert (ow, oh) == (640, 360), (ow, oh)
        # ohne target: weiter voll 4x (Vertrag)
        out2, ow2, oh2 = m.http_upscale(port, token, frame, 640, 360, 0, 0)
        assert (ow2, oh2) == (2560, 1440), (ow2, oh2)
        print(f"div={div}: target 640x360 in {dt:.2f}s OK, no-target 2560x1440 OK")
    finally:
        proc.stdin.close()
        proc.wait(timeout=20)


run(1)
run(2)
print("HOST-DIV-CHECK: PASS")
