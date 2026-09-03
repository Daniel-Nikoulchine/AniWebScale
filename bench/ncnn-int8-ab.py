#!/usr/bin/env python3
"""INT8 Go/No-Go-Gate: fp16-Basis vs quantisiertes ncnn-Modell (Vulkan).

Beide Läufe nutzen denselben deterministischen Gradienten-Frame und denselben
Case (Default 853x480 = Cap-Modus), --dump-frame sichert je einen RGBA8-Frame.
Gate aus dem Report (2.9. abends):
  GO  <=>  PSNR(int8, fp16) >= 32 dB  UND  p50_int8 < p50_fp16
Sonst NO-GO mit Grund. Schreibt artifacts/ncnn-int8-ab-<ts>.json.

Der Gradient ist kein Anime-Material: PSNR misst hier nur die numerische
Treue der Quantisierung, keine visuelle Qualität. Reicht fürs Gate, weil die
Browser-INT8-Analogie (32.5 dB, visuell verlustfrei) denselben Maßstab nutzt.

Usage:
  python3 bench/ncnn-int8-ab.py [--bench BIN] [--warmup N] [--samples N]
"""

from __future__ import annotations

import argparse
import datetime
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PSNR_GATE_DB = 32.0


def run_bench(bench: Path, param: str, bbin: str, case: str, warmup: int,
              samples: int, dump: Path, out_json: Path, extra: list[str]) -> dict:
    cmd = [str(bench), "--param", param, "--bin", bbin,
           "--cases", case, "--warmup", str(warmup), "--samples", str(samples),
           "--output", str(out_json), "--dump-frame", str(dump), *extra]
    print(f"[ab] {' '.join(cmd)}", flush=True)
    p = subprocess.run(cmd, capture_output=True, text=True)
    sys.stderr.write(p.stderr)
    if p.returncode != 0:
        raise SystemExit(f"benchmark failed (exit {p.returncode}): {param}")
    return json.loads(out_json.read_text())


def psnr_db(ref: bytes, got: bytes) -> float:
    import numpy as np
    a = np.frombuffer(ref, dtype=np.uint8).astype(np.float64)
    b = np.frombuffer(got, dtype=np.uint8).astype(np.float64)
    if a.shape != b.shape:
        raise SystemExit(f"dump size mismatch: {a.shape} vs {b.shape}")
    # Nur RGB; Alpha ist konstant 255 und würde das Ergebnis schönen.
    a = a.reshape(-1, 4)[:, :3]
    b = b.reshape(-1, 4)[:, :3]
    mse = float(((a - b) ** 2).mean())
    if mse == 0:
        return float("inf")
    return 10.0 * math.log10(255.0 * 255.0 / mse)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bench", default="native/linux-host/build/aniwebscale-ncnn-benchmark")
    ap.add_argument("--param", default="models/realesrgan/ncnn/realesr-animevideov3-x4.param")
    ap.add_argument("--bin", default="models/realesrgan/ncnn/realesr-animevideov3-x4.bin")
    ap.add_argument("--int8-param", default="models/realesrgan/ncnn/realesr-animevideov3-x4.int8.param")
    ap.add_argument("--int8-bin", default="models/realesrgan/ncnn/realesr-animevideov3-x4.int8.bin")
    ap.add_argument("--case", default="853x480")
    ap.add_argument("--warmup", type=int, default=3)
    ap.add_argument("--samples", type=int, default=25)
    args = ap.parse_args()

    bench = ROOT / args.bench
    if not bench.exists():
        raise SystemExit(f"benchmark binary missing: {bench}")
    for f in (args.param, args.bin, args.int8_param, args.int8_bin):
        if not (ROOT / f).exists():
            raise SystemExit(f"missing model file: {f} (run calibrate-ncnn-int8.sh first)")

    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    work = ROOT / "artifacts" / f"ncnn-int8-ab-{ts}"
    work.mkdir(parents=True, exist_ok=True)

    fp16 = run_bench(bench, args.param, args.bin, args.case, args.warmup,
                     args.samples, work / "fp16.rgba", work / "fp16.json", [])
    int8 = run_bench(bench, args.int8_param, args.int8_bin, args.case,
                     args.warmup, args.samples, work / "int8.rgba",
                     work / "int8.json", ["--int8"])

    c0, c1 = fp16["cases"][0], int8["cases"][0]
    if c0["status"] != "ok" or c1["status"] != "ok":
        raise SystemExit(f"bench status bad: fp16={c0['status']} int8={c1['status']}")
    db = psnr_db((work / "fp16.rgba").read_bytes(), (work / "int8.rgba").read_bytes())
    p50_fp16, p50_int8 = c0["p50Ms"], c1["p50Ms"]

    reasons: list[str] = []
    if not db >= PSNR_GATE_DB:
        reasons.append(f"PSNR {db:.1f} dB < {PSNR_GATE_DB} dB")
    if not p50_int8 < p50_fp16:
        reasons.append(f"kein Speedup: int8 p50 {p50_int8:.1f} ms >= fp16 p50 {p50_fp16:.1f} ms")
    verdict = "GO" if not reasons else "NO-GO"

    report = {
        "verdict": verdict,
        "case": args.case,
        "psnrDb": db,
        "psnrGateDb": PSNR_GATE_DB,
        "p50MsFp16": p50_fp16,
        "p50MsInt8": p50_int8,
        "speedup": p50_fp16 / p50_int8 if p50_int8 else 0,
        "reasons": reasons,
        "fp16": {"mean": c0["averageMs"], "p95": c0["p95Ms"], "rme": c0["rme"]},
        "int8": {"mean": c1["averageMs"], "p95": c1["p95Ms"], "rme": c1["rme"]},
    }
    (work / "verdict.json").write_text(json.dumps(report, indent=2))
    print(f"[ab] case {args.case}: PSNR {db:.2f} dB, "
          f"p50 fp16 {p50_fp16:.1f} ms vs int8 {p50_int8:.1f} ms "
          f"({p50_fp16 / p50_int8:.2f}x) -> {verdict}")
    if reasons:
        print(f"[ab] reasons: {'; '.join(reasons)}")
    print(f"[ab] report: {work / 'verdict.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
