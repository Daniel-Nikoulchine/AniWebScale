#!/usr/bin/env bash
# Kalibriert das ncnn-INT8-Modell für RealESRGAN AnimeVideo v3 (Upstream-Flow:
# ncnn2table -> ncnn2int8, siehe ncnn/docs/how-to-use-and-FAQ/quantized-int8-inference.md).
#
# Das Netz ist pnnx-stilig (input.1/splitncnn), darum entfällt ncnnoptimize.
# Preproc-Norm des Hosts: RGB [0,1], kein Mean-Abzug -> norm=1/255.
# Kalibriermaterial: tests/fixtures/one_piece_clip.mp4 (echtes Anime-Material),
# auf Cap-Nähe (640x360) skaliert, weil shape die Calib-Bilder resizet.
#
# Usage: bash native/spike/calibrate-ncnn-int8.sh [--frames N] [--threads N]
# Output: models/realesrgan/ncnn/realesr-animevideov3-x4.int8.{param,bin,table}
set -euo pipefail

FRAMES=200
THREADS=$(nproc)
while [ $# -gt 0 ]; do
  case "$1" in
    --frames) FRAMES="${2:?"--frames needs a value"}"; shift 2 ;;
    --threads) THREADS="${2:?"--threads needs a value"}"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NCNN_SRC="$ROOT/native/spike/third_party/ncnn"
TOOLS_BUILD="$ROOT/native/spike/build-tools"
MODEL_DIR="$ROOT/models/realesrgan/ncnn"
CALIB_DIR="$ROOT/artifacts/ncnn-int8-calib"
PARAM="$MODEL_DIR/realesr-animevideov3-x4.param"
BIN="$MODEL_DIR/realesr-animevideov3-x4.bin"

[ -f "$PARAM" ] || { echo "missing $PARAM" >&2; exit 1; }
[ -f "$BIN" ] || { echo "missing $BIN" >&2; exit 1; }
[ -d "$NCNN_SRC" ] || { echo "ncnn source missing, run: python3 native/spike/fetch-sources.py" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg missing" >&2; exit 1; }

# 1) Tools bauen (eigener Build-Dir, Host-Build bleibt unberührt).
if [ ! -x "$TOOLS_BUILD/tools/quantize/ncnn2table" ]; then
  echo "[calib] configuring ncnn tools build..."
  cmake -S "$NCNN_SRC" -B "$TOOLS_BUILD" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DNCNN_VULKAN=ON \
    -DNCNN_SHARED_LIB=OFF \
    -DNCNN_OPENMP=OFF \
    -DNCNN_BUILD_TOOLS=ON \
    -DNCNN_BUILD_EXAMPLES=OFF \
    -DNCNN_BUILD_BENCHMARK=OFF \
    -DNCNN_BUILD_TESTS=OFF \
    -DNCNN_PYTHON=OFF \
    -DNCNN_SIMPLEOCV=ON
  echo "[calib] building ncnn2table + ncnn2int8 (dauert)..."
  cmake --build "$TOOLS_BUILD" --target ncnn2table ncnn2int8 -j"$THREADS"
fi
TABLE_TOOL="$TOOLS_BUILD/tools/quantize/ncnn2table"
INT8_TOOL="$TOOLS_BUILD/tools/quantize/ncnn2int8"

# 2) Kalibrierframes aus dem Echten Material ziehen.
mkdir -p "$CALIB_DIR"
if [ "$(find "$CALIB_DIR" -name '*.png' | wc -l)" -lt "$FRAMES" ]; then
  echo "[calib] extracting $FRAMES frames..."
  rm -f "$CALIB_DIR"/frame_*.png
  ffmpeg -hide_banner -loglevel error -y -i "$ROOT/tests/fixtures/one_piece_clip.mp4" \
    -vf "fps=2,scale=640:360" -frames:v "$FRAMES" "$CALIB_DIR/frame_%04d.png"
fi
find "$CALIB_DIR" -name 'frame_*.png' | sort > "$CALIB_DIR/imagelist.txt"
echo "[calib] $(wc -l < "$CALIB_DIR/imagelist.txt") calib frames"

# 3) Tabelle + INT8-Modell.
TABLE="$MODEL_DIR/realesr-animevideov3-x4.int8.table"
echo "[calib] ncnn2table..."
"$TABLE_TOOL" "$PARAM" "$BIN" "$CALIB_DIR/imagelist.txt" "$TABLE" \
  mean=[0,0,0] norm=[0.0039215686,0.0039215686,0.0039215686] \
  shape=[640,360,3] pixel=RGB thread="$THREADS" method=kl
echo "[calib] ncnn2int8..."
"$INT8_TOOL" "$PARAM" "$BIN" \
  "$MODEL_DIR/realesr-animevideov3-x4.int8.param" \
  "$MODEL_DIR/realesr-animevideov3-x4.int8.bin" "$TABLE"
echo "[calib] done:"
ls -la "$MODEL_DIR"/realesr-animevideov3-x4.int8.*
echo "[calib] next: npm run bench:ncnn:int8"
