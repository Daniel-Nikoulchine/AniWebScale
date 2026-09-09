#!/usr/bin/env python3
"""Stufe 5 A/B: First-Frame-Latenz frisch gespawnter Host, n Runs je Seite.

vorher : ANIWEBSCALE_NO_WARMUP=1 (kalt)
nachher: Default mit Session-Warmup
Misst Frame0 + Frame1 (Steady-Referenz) je Spawn, 640x360 mit Target.
Usage: S5_N=5 s5-warmup-ab.py  -> JSON auf stdout
"""
import importlib.util
import json
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

W, H = 640, 360
N = int(os.environ.get("S5_N", "5"))


def one_run(warmup_on):
    env = dict(os.environ)
    if not warmup_on:
        env["ANIWEBSCALE_NO_WARMUP"] = "1"
    frame = m.make_frame(W, H)
    proc = subprocess.Popen([m.HOST], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            env=env)
    try:
        m.framed(proc, {"type": "hello", "protocolVersion": 3,
                        "requestId": "s5"})
        hello = m.read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        ms = []
        for _ in range(2):
            t0 = time.time()
            out, ow, oh = m.http_upscale(port, token, frame, W, H, W, H)
            assert (ow, oh) == (W, H), (ow, oh)
            ms.append((time.time() - t0) * 1000)
        return ms
    finally:
        proc.stdin.close()
        proc.wait(timeout=20)


out = {"vorher": [], "nachher": []}
for i in range(N):
    out["vorher"].append(one_run(False))
    print(f"vorher {i}: frame0={out['vorher'][-1][0]:.1f} frame1={out['vorher'][-1][1]:.1f}",
          file=sys.stderr, flush=True)
for i in range(N):
    out["nachher"].append(one_run(True))
    print(f"nachher {i}: frame0={out['nachher'][-1][0]:.1f} frame1={out['nachher'][-1][1]:.1f}",
          file=sys.stderr, flush=True)


def summ(rows, idx):
    v = [r[idx] for r in rows]
    return {"mean": round(statistics.mean(v), 1), "min": round(min(v), 1),
            "max": round(max(v), 1), "n": len(v)}


res = {"n": N, "case": "640x360-target",
       "vorher_frame0": summ(out["vorher"], 0),
       "vorher_frame1": summ(out["vorher"], 1),
       "nachher_frame0": summ(out["nachher"], 0),
       "nachher_frame1": summ(out["nachher"], 1)}
v0 = res["vorher_frame0"]["mean"]
n0 = res["nachher_frame0"]["mean"]
res["delta_ms"] = round(v0 - n0, 1)
res["speedup"] = round(v0 / n0, 2) if n0 else None
print(json.dumps(res, indent=2))
