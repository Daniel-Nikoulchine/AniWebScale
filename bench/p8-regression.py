#!/usr/bin/env python3
"""Full p8 regression: single-pass identity + downscale, tiled path (the RADV
VkCompute-reuse fix), and the clean-shutdown exit code (net.clear fix)."""
import importlib.util
import os
import subprocess
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "t", os.path.join(_HERE, "..", "tests", "host-target-downscale.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def run_case(cases, label):
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    results = []
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        for (W, H, tw, th, what) in cases:
            frame = m.make_frame(W, H)
            t0 = time.time()
            try:
                out, ow, oh = m.http_upscale(port, token, frame, W, H, tw, th)
                results.append(f"  {what} {W}x{H}->({tw or 'auto'}x{th or 'auto'}): OK "
                                f"{ow}x{oh} in {time.time()-t0:.1f}s")
            except Exception as e:
                results.append(f"  {what} {W}x{H}: CRASH {type(e).__name__}")
                break
    finally:
        proc.stdin.close()
        rc = proc.wait(timeout=20)
        err = proc.stderr.read().decode(errors="replace")
    print(f"[{label}]")
    for line in results:
        print(line)
    print(f"  exit code: {rc} ({'CLEAN' if rc == 0 else 'CRASHED'})")
    for line in err.strip().splitlines()[-4:]:
        if "shutting" in line or "upscale" in line:
            print("  stderr:", line)
    return rc == 0 and "CRASH" not in "".join(results)


ok = True
# single-pass sizes + one downscale each
ok &= run_case([
    (640, 360, 0, 0, "single-full"),
    (640, 360, 1920, 1080, "single-down"),
    (1280, 720, 0, 0, "720p-limit"),
], "single-pass")
# tiled sizes, full + downscale + edge
ok &= run_case([
    (1281, 721, 0, 0, "tiled-edge"),
    (1600, 900, 2560, 1440, "tiled-900p-down"),
    (1920, 1080, 0, 0, "tiled-1080p-full"),
    (1920, 1080, 2560, 1440, "tiled-1080p-down"),
], "tiled")
print("RESULT:", "ALL PASS" if ok else "FAILURES PRESENT")
raise SystemExit(0 if ok else 1)
