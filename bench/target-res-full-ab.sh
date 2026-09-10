#!/usr/bin/env bash
# Stufe 1 Voll-A/B alle 4 Cases, n=30. Je ein JSON vorher (div1) / nachher (div2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/native/linux-host/build/aniwebscale-ncnn-benchmark"
ART="$ROOT/artifacts"
"$BIN" --warmup 3 --samples 30 --output "$ART/perf-prog-s1-div1-full.json" 2>&1 | grep -E "case |summary:" || true
"$BIN" --warmup 3 --samples 30 --infer-div 2 --output "$ART/perf-prog-s1-div2-full.json" 2>&1 | grep -E "case |summary:" || true
echo "=== vorher (div1) vs nachher (div2) ==="
jq -r '"\(.width)x\(.height): \(.averageMs)ms fps=\(.fps)"' "$ART/perf-prog-s1-div1-full.json" > /tmp/s1vor.txt || true
jq -r '.cases[] | "\(.width)x\(.height): \(.averageMs)ms fps=\(.fps)"' "$ART/perf-prog-s1-div1-full.json"
echo "---"
jq -r '.cases[] | "\(.width)x\(.height) -> \(.outWidth)x\(.outHeight): \(.averageMs)ms fps=\(.fps)"' "$ART/perf-prog-s1-div2-full.json"
