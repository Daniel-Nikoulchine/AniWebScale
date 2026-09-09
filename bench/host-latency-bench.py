#!/usr/bin/env python3
"""Host E2E latency bench (stdlib only, no numpy).

Measures full host round-trip (upload + inference + download) over the
loopback HTTP transport on deterministic gradient frames — the same framing
as tests/host-target-downscale.py. Used for A/B of host-path changes
(zero-copy upload, tiled vs single-pass, preproc variants).

Usage: python3 bench/host-latency-bench.py [--host BIN] [--cases WxH,...]
       [--warmup N] [--samples N] [--tw W --th H] [--dump FILE] [--output FILE]

Writes JSON report to --output (default stdout); stderr carries summary.
Exit 0 on success, 1 on any failure.
"""
import http.client
import json
import statistics
import struct
import subprocess
import sys
import time

HERE = __file__.rsplit("/", 1)[0]
HOST_DEFAULT = HERE + "/../native/linux-host/build/aniwebscale-ncnn-host"


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


def make_frame(w, h, salt=0):
    frame = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            o = (y * w + x) * 4
            frame[o] = (x * 3 + salt) & 0xFF
            frame[o + 1] = (y * 5 + salt) & 0xFF
            frame[o + 2] = ((x + y) * 7 + salt) & 0xFF
            frame[o + 3] = 255
    return bytes(frame)


def call(port, token, frame, w, h, tw, th):
    query = f"/upscale?token={token}&w={w}&h={h}"
    if tw and th:
        query += f"&tw={tw}&th={th}"
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=120)
    start = time.perf_counter()
    conn.request("POST", query, body=frame,
                 headers={"Content-Type": "text/plain"})
    response = conn.getresponse()
    body = response.read()
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    out_w = int(response.headers.get("X-Frame-Width", 0))
    out_h = int(response.headers.get("X-Frame-Height", 0))
    conn.close()
    return elapsed_ms, body, out_w, out_h


def percentile(v, p):
    s = sorted(v)
    idx = min(len(s) - 1, max(0, int(-(-p * len(s) // 1)) - 1))
    return s[idx]


def main(argv):
    host = HOST_DEFAULT
    cases = [(480, 360), (640, 360)]
    warmup = 2
    samples = 10
    tw, th = 0, 0
    dump_path = None
    output_path = None
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--host" and i + 1 < len(argv):
            host = argv[i + 1]; i += 2
        elif a == "--cases" and i + 1 < len(argv):
            cases = []
            for tok in argv[i + 1].split(","):
                w, h = tok.split("x")
                cases.append((int(w), int(h)))
            i += 2
        elif a == "--warmup" and i + 1 < len(argv):
            warmup = int(argv[i + 1]); i += 2
        elif a == "--samples" and i + 1 < len(argv):
            samples = int(argv[i + 1]); i += 2
        elif a == "--tw" and i + 1 < len(argv):
            tw = int(argv[i + 1]); i += 2
        elif a == "--th" and i + 1 < len(argv):
            th = int(argv[i + 1]); i += 2
        elif a == "--dump" and i + 1 < len(argv):
            dump_path = argv[i + 1]; i += 2
        elif a == "--output" and i + 1 < len(argv):
            output_path = argv[i + 1]; i += 2
        else:
            print(f"unknown arg: {a}", file=sys.stderr)
            return 2

    proc = subprocess.Popen([host], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        framed(proc, {"type": "hello", "protocolVersion": 3,
                      "requestId": "host-latency-bench"})
        hello = read_framed(proc.stdout)
        port, token = int(hello["httpPort"]), hello["httpToken"]
        results = []
        for (w, h) in cases:
            frame = make_frame(w, h)
            times = []
            last_body = b""
            ow, oh = 0, 0
            for n in range(warmup + samples):
                ms, body, ow, oh = call(port, token, frame, w, h, tw, th)
                if n >= warmup:
                    times.append(ms)
                if n == warmup + samples - 1:
                    last_body = body
            if len(last_body) != ow * oh * 4:
                print(f"[{w}x{h}] SIZE MISMATCH {len(last_body)} != {ow}x{oh}x4",
                      file=sys.stderr)
                return 1
            entry = {
                "width": w, "height": h, "targetWidth": tw, "targetHeight": th,
                "outWidth": ow, "outHeight": oh,
                "averageMs": sum(times) / len(times),
                "p50Ms": percentile(times, 0.5),
                "p95Ms": percentile(times, 0.95),
                "fps": 1000.0 / (sum(times) / len(times)),
                "samplesMs": [round(t, 4) for t in times],
            }
            results.append(entry)
            print(f"[{w}x{h}->({ow}x{oh})] mean {entry['averageMs']:.1f}ms "
                  f"p50 {entry['p50Ms']:.1f} p95 {entry['p95Ms']:.1f} "
                  f"fps {entry['fps']:.1f}", file=sys.stderr)
            if dump_path and (w, h) == cases[0]:
                with open(dump_path, "wb") as f:
                    f.write(last_body)
                print(f"[dump] {len(last_body)} bytes -> {dump_path}",
                      file=sys.stderr)
        report = {"tool": "host-latency-bench", "host": host,
                  "warmup": warmup, "samples": samples, "cases": results}
        out = json.dumps(report, indent=1)
        if output_path:
            with open(output_path, "w") as f:
                f.write(out)
        else:
            print(out)
    finally:
        if proc.stdin:
            proc.stdin.close()
        proc.wait(timeout=10)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
