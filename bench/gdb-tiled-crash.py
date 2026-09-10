#!/usr/bin/env python3
"""Reproduce the tiled-path SIGSEGV under gdb and print the backtrace."""
import importlib.util
import os
import subprocess
import sys
import time
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

proc = subprocess.Popen(
    ["gdb", "-q", "-batch", "-ex", "run", "-ex", "bt", "--args", m.HOST],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    m.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
    hello = m.read_framed(proc.stdout)
    port, token = int(hello["httpPort"]), hello["httpToken"]
    W, H = 1920, 1080
    frame = m.make_frame(W, H, salt=7)
    url = f"http://127.0.0.1:{port}/upscale?token={token}&w={W}&h={H}"
    req = urllib.request.Request(url, data=frame, method="POST",
                                 headers={"Content-Type": "text/plain"})
    try:
        out = urllib.request.urlopen(req, timeout=180).read()
        print("CLIENT: got", len(out), "bytes")
    except Exception as e:
        print("CLIENT ERROR:", e)
    time.sleep(8)  # let gdb catch SIGSEGV and print the backtrace
finally:
    proc.stdin.close()
    try:
        out, _ = proc.communicate(timeout=15)
        print(out.decode(errors="replace")[-4000:])
    except Exception:
        proc.kill()
