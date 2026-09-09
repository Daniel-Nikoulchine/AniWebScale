#!/usr/bin/env bash
# Stufe 1 A/B: vorher (voll 4x, div=1) vs div=2 vs div=4 + Dumps fuers Gate.
# Usage: bench/target-res-ab.sh [--quick]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/native/linux-host/build"
BIN="$BUILD/aniwebscale-ncnn-benchmark"
ART="$ROOT/artifacts"
VENV=/home/daniel/Projects/anime4kBrowser/.venv-realesrgan/bin/python
WARMUP=3; SAMPLES=30
if [[ "${1:-}" == "--quick" ]]; then WARMUP=2; SAMPLES=10; fi
[ -f "$BUILD/CMakeCache.txt" ] || { echo "build nicht konfiguriert" >&2; exit 1; }
cmake --build "$BUILD" --target aniwebscale-ncnn-benchmark -j4
run() { # div outfile dump
  extra=""; if [[ "$1" != "1" ]]; then extra="--infer-div $1"; fi
  "$BIN" --warmup "$WARMUP" --samples "$SAMPLES" $extra \
    --cases 640x360 --dump-frame "$3" --output "$2" 2>&1 | grep -E "case |JSON written" || true
}
echo "[ab] div=1 (voll-4x, Referenz) ..."
run 1 "$ART/perf-prog-target-res-div1.json" "$ART/target-res-div1-360.raw"
echo "[ab] div=2 (4x weniger Netz-Pixel) ..."
run 2 "$ART/perf-prog-target-res-div2.json" "$ART/target-res-div2-360.raw"
echo "[ab] div=4 (infer-at-target, 16x weniger) ..."
run 4 "$ART/perf-prog-target-res-div4.json" "$ART/target-res-div4-360.raw"
echo "[ab] summary:"
jq -r '"div=\(.config.inferDiv) out=\(.cases[0].outWidth)x\(.cases[0].outHeight) mean=\(.cases[0].averageMs)ms p95=\(.cases[0].p95Ms)ms fps=\(.cases[0].fps) status=\(.cases[0].status)"' \
  "$ART/perf-prog-target-res-div1.json" "$ART/perf-prog-target-res-div2.json" "$ART/perf-prog-target-res-div4.json"
for d in 2 4; do
  echo "[ab] quality-gate div=$d:"
  "$VENV" bench/target-res-quality.py \
    "$ART/target-res-div1-360.raw" 2560 1440 "$ART/target-res-div$d-360.raw" 640 360 || true
done
