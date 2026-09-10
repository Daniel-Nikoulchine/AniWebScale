#!/usr/bin/env bash
# Run the ncnn-Vulkan RealESRGAN native host benchmark.
# Builds the benchmark binary if needed, then runs it on the RX 6750 XT.
# Usage:
#   ./native/linux-host/run-benchmark.sh [--quick] [--compare-cpu] [--output FILE]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$ROOT/native/linux-host/build"
BIN="$BUILD/aniwebscale-ncnn-benchmark"
OUTPUT="${OUTPUT:-$ROOT/artifacts/ncnn-vulkan-rx6750xt-benchmark.json}"

WARMUP=3
SAMPLES=30
COMPARE_CPU=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick) WARMUP=2; SAMPLES=10; shift ;;
    --compare-cpu) COMPARE_CPU="--compare-cpu"; shift ;;
    --output) OUTPUT="${2:?"--output needs a value"}"; shift 2 ;;
    --warmup) WARMUP="${2:?"--warmup needs a value"}"; shift 2 ;;
    --samples) SAMPLES="${2:?"--samples needs a value"}"; shift 2 ;;
    *) echo "unknown arg $1" >&2; exit 2 ;;
  esac
done

echo "[run-benchmark] building $BIN ..."
[ -f "$BUILD/CMakeCache.txt" ] || { echo "[run-benchmark] $BUILD is not configured (run cmake first)" >&2; exit 1; }
cmake --build "$BUILD" --target aniwebscale-ncnn-benchmark -j4

echo "[run-benchmark] running warmup=$WARMUP samples=$SAMPLES $COMPARE_CPU -> $OUTPUT"
mkdir -p "$(dirname "$OUTPUT")"
"$BIN" --warmup "$WARMUP" --samples "$SAMPLES" $COMPARE_CPU --output "$OUTPUT"

echo "[run-benchmark] done"
ls -lh "$OUTPUT"
echo "--- summary (stderr above, JSON in $OUTPUT) ---"
