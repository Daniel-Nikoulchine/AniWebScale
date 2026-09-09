#!/usr/bin/env python3
"""Host-level tiled-path benchmark: drives aniwebscale-ncnn-host over framed
stdin/stdout with shm file transport, timing full 1080p (tiled) upscales.
Usage: host-tiled-bench.py [--host BIN] [--warmup N] [--samples N] [--json FILE]
"""
import json, os, struct, subprocess, sys, time, statistics

HOST = "native/linux-host/build/aniwebscale-ncnn-host"
WARMUP = 2
SAMPLES = 6
SIZES = [(1280, 720, "720p-single"), (1920, 1080, "1080p-tiled")]

def parse_args():
    host, warmup, samples, json_out = HOST, WARMUP, SAMPLES, None
    a = sys.argv[1:]
    i = 0
    while i < len(a):
        if a[i] == "--host": host, i = a[i+1], i+2
        elif a[i] == "--warmup": warmup, i = int(a[i+1]), i+2
        elif a[i] == "--samples": samples, i = int(a[i+1]), i+2
        elif a[i] == "--json": json_out, i = a[i+1], i+2
        else: print(f"unknown arg {a[i]}", file=sys.stderr); sys.exit(2)
    return host, warmup, samples, json_out

def write_framed(proc, obj):
    payload = json.dumps(obj).encode()
    proc.stdin.write(struct.pack("<I", len(payload)) + payload)
    proc.stdin.flush()

def read_framed(proc):
    hdr = proc.stdout.read(4)
    if len(hdr) < 4: raise EOFError("host closed stdout")
    (n,) = struct.unpack("<I", hdr)
    data = b""
    while len(data) < n:
        chunk = proc.stdout.read(n - len(data))
        if not chunk: raise EOFError("host closed mid-message")
        data += chunk
    return json.loads(data)

def make_rgba(w, h):
    buf = bytearray(w*h*4)
    for y in range(h):
        for x in range(w):
            o = (y*w+x)*4
            buf[o] = (x*3) & 0xff
            buf[o+1] = (y*5) & 0xff
            buf[o+2] = ((x+y)*7) & 0xff
            buf[o+3] = 255
    return buf

def main():
    host, warmup, samples, json_out = parse_args()
    # The host confines shm transport to the shared-memory filesystem
    # (is_safe_shm_path): fail fast where it is absent instead of falling
    # back to a directory the host rejects with shm_path_rejected.
    if not os.path.isdir("/dev/shm"):
        raise SystemExit("host-tiled-bench needs /dev/shm (the host only accepts shm paths there)")
    tmp = "/dev/shm"
    shm_in = os.path.join(tmp, f"host-bench-in-{os.getpid()}.rgba")
    shm_out = os.path.join(tmp, f"host-bench-out-{os.getpid()}.rgba")
    env = dict(os.environ)
    env["ANIWEBSCALE_HOST_IDLE_TIMEOUT_S"] = "0"
    proc = subprocess.Popen([host], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=sys.stderr, env=env)
    try:
        write_framed(proc, {"type": "hello", "requestId": "bench-hello"})
        resp = read_framed(proc)
        assert resp.get("type") == "ready", resp
        results = []
        req_id = 0
        for (w, h, label) in SIZES:
            rgba = make_rgba(w, h)
            with open(shm_in, "wb") as f: f.write(rgba)
            times = []
            out_w = out_h = 0
            for i in range(warmup + samples):
                # rewrite input each time (host only reads)
                with open(shm_in, "wb") as f: f.write(rgba)
                try: os.unlink(shm_out)
                except FileNotFoundError: pass
                req_id += 1
                t0 = time.perf_counter()
                write_framed(proc, {"type": "realesrganUpscale", "requestId": f"bench-{req_id}",
                                    "width": w, "height": h, "shmIn": shm_in, "shmOut": shm_out})
                r = read_framed(proc)
                dt = (time.perf_counter() - t0) * 1000
                if r.get("type") != "realesrganResult":
                    print(f"FAILED {label}: {r}", file=sys.stderr)
                    results.append({"label": label, "width": w, "height": h, "status": "error",
                                    "error": str(r)[:200]})
                    break
                out_w, out_h = int(r["width"]), int(r["height"])
                if i >= warmup: times.append(dt)
            else:
                times.sort()
                mean = sum(times)/len(times)
                results.append({"label": label, "width": w, "height": h, "status": "ok",
                                "outWidth": out_w, "outHeight": out_h,
                                "meanMs": mean, "p50Ms": times[len(times)//2],
                                "p95Ms": times[min(len(times)-1, int(len(times)*0.95))],
                                "samplesMs": times})
                print(f"{label} {w}x{h} -> {out_w}x{out_h}: mean {mean:.1f}ms p50 {times[len(times)//2]:.1f} (n={len(times)})")
        if json_out:
            with open(json_out, "w") as f: json.dump({"results": results}, f, indent=2)
            print(f"JSON written to {json_out}")
    finally:
        try: proc.stdin.close()
        except BrokenPipeError: pass
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()
            raise SystemExit("host did not exit after stdin EOF")
        for path in (shm_in, shm_out):
            try: os.unlink(path)
            except OSError: pass

if __name__ == "__main__":
    main()
