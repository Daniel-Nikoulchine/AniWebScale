#!/usr/bin/env python3
"""Check whether the tiled (>720p) path still works over the STDIN transport.

p4 measured it via shm; this uses b64 (slower but same core). If this PASSES
while HTTP crashes, the bug is transport-specific; if it crashes too, the
tiled core or the p8 run_gpu_frame change broke it.
"""
import base64
import importlib.util
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

W, H = 1920, 1080
proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE)
try:
    m.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
    hello = m.read_framed(proc.stdout)
    assert hello.get("type") == "ready"
    frame = m.make_frame(W, H, salt=3)
    print(f"[stdin-tiled] sending {W}x{H} b64 ({len(frame) // 1024} KiB raw)...")
    m.framed(proc, {
        "type": "realesrganUpscale", "protocolVersion": 3, "requestId": "u1",
        "width": W, "height": H, "data": base64.b64encode(frame).decode(),
        "fp16": True,
    })
    result = m.read_framed(proc.stdout)
    print(f"[stdin-tiled] reply: {result.get('type')} {result.get('width')}x{result.get('height')} "
          f"{result.get('timeMs', 0):.0f} ms")
    assert result.get("width") == W * 4 and result.get("height") == H * 4
    print("[stdin-tiled] PASS: tiled path works over stdin")
finally:
    proc.stdin.close()
    rc = proc.wait(timeout=10)
    print("[stdin-tiled] host exit:", rc)
    err = proc.stderr.read().decode(errors="replace")
    for line in err.strip().splitlines()[-6:]:
        print("   ", line)
