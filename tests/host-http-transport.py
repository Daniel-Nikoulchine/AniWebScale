#!/usr/bin/env python3
"""Smoke test for the p7 HTTP transport of aniwebscale-ncnn-host.

Spawns the host with the framed-JSON stdin protocol, reads httpPort/httpToken
from the hello reply, POSTs a raw RGBA8 frame to /upscale, and compares the
4x output against a second run over the stdin b64 path. Both outputs must be
byte-identical (shared upscale core) and 4x the input size.

Usage: python3 tests/host-http-transport.py [path-to-host]
"""
import base64
import json
import socket
import struct
import subprocess
import sys
import time
import urllib.request

HOST = sys.argv[1] if len(sys.argv) > 1 else "native/linux-host/build/aniwebscale-ncnn-host"
W, H = 640, 360


def framed(proc, obj):
    data = json.dumps(obj).encode()
    proc.stdin.write(struct.pack("<I", len(data)) + data)
    proc.stdin.flush()


def read_framed(stream):
    header = b""
    while len(header) < 4:
        chunk = stream.read(4 - len(header))
        if not chunk:
            raise RuntimeError("host closed stdout")
        header += chunk
    (length,) = struct.unpack("<I", header)
    data = b""
    while len(data) < length:
        chunk = stream.read(length - len(data))
        if not chunk:
            raise RuntimeError("host closed stdout mid-message")
        data += chunk
    return json.loads(data)


def make_frame(w, h):
    # Same generator as benchmark.cpp make_rgba (deterministic gradient)
    import numpy as np
    x = np.arange(w, dtype=np.int64)
    y = np.arange(h, dtype=np.int64)[:, None]
    frame = np.empty((h, w, 4), dtype=np.uint8)
    frame[..., 0] = (x * 3) & 0xFF
    frame[..., 1] = (y * 5) & 0xFF
    frame[..., 2] = ((x + y) * 7) & 0xFF
    frame[..., 3] = 255
    return frame.tobytes()


def main():
    proc = subprocess.Popen([HOST], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    try:
        framed(proc, {"type": "hello", "protocolVersion": 3, "requestId": "h1"})
        hello = read_framed(proc.stdout)
        print("[test] hello:", {k: hello.get(k) for k in ("type", "httpPort")})
        assert hello.get("type") == "ready", hello
        port = int(hello["httpPort"])
        token = hello["httpToken"]
        assert port > 0, "no http port advertised"

        framed(proc, {"type": "capabilities", "protocolVersion": 3, "requestId": "c1"})
        caps = read_framed(proc.stdout)
        assert caps.get("realesrganHttp") is True, caps
        print(f"[test] capabilities: realesrganHttp=true port={port}")

        frame = make_frame(W, H)

        # --- HTTP path ---
        url = f"http://127.0.0.1:{port}/upscale?token={token}&w={W}&h={H}"
        t0 = time.perf_counter()
        req = urllib.request.Request(url, data=frame, method="POST",
                                     headers={"Content-Type": "text/plain"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            http_out = resp.read()
            out_w = int(resp.headers["X-Frame-Width"])
            out_h = int(resp.headers["X-Frame-Height"])
        t_http = (time.perf_counter() - t0) * 1000
        print(f"[test] http upscale: {out_w}x{out_h} {len(http_out)} bytes in {t_http:.1f} ms")
        assert (out_w, out_h) == (W * 4, H * 4)
        assert len(http_out) == W * 4 * H * 4 * 4 - 0 * 0  # 4x dims, 4 B/px
        assert len(http_out) == (W * 4) * (H * 4) * 4

        # --- stdin b64 path must produce the identical bytes ---
        framed(proc, {
            "type": "realesrganUpscale", "protocolVersion": 3, "requestId": "u1",
            "width": W, "height": H, "data": base64.b64encode(frame).decode(),
            "fp16": True,
        })
        result = read_framed(proc.stdout)
        assert result.get("type") == "realesrganResult", result
        stdin_out = base64.b64decode(result["data"])
        print(f"[test] stdin b64 upscale: {result['width']}x{result['height']} in {result['timeMs']:.1f} ms")
        assert stdin_out == http_out, "HTTP and stdin outputs differ"
        print("[test] PASS: outputs byte-identical between transports")

        # --- second HTTP call on a fresh connection (keep-alive across requests) ---
        with urllib.request.urlopen(req, timeout=30) as resp:
            again = resp.read()
        assert again == http_out
        print("[test] PASS: repeat request identical")
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)
        err = proc.stderr.read().decode(errors="replace")
        print("[host stderr]", "\n[host stderr] ".join(err.strip().splitlines()[-6:]))


if __name__ == "__main__":
    main()
