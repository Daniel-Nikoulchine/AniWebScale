#!/usr/bin/env python3
"""Port the t3 RealCUGAN ONNX inference path to RealESRGAN (x4).

Reads the RealCUGAN source from a given t3 checkpoint commit and writes a
RealESRGAN variant into the repo. Only the scaling factor (2 -> 4) and the
model file differ; everything else is identical ONNX webgpu/wasm plumbing.

Run from the repo root:
    python scripts/port-realesrgan-from-realcugan.py <commit>

Idempotent-ish: overwrites the realesrgan-* files with the transformed content.
"""
import subprocess
import sys
import re

COMMIT = sys.argv[1] if len(sys.argv) > 1 else "b5afdda"

# (source_path_in_commit, dest_path) for the shared + core files.
FILES = [
    ("src/shared/realcugan-tiling.ts",        "src/shared/realesrgan-tiling.ts"),
    ("src/shared/realcugan-pacing.ts",        "src/shared/realesrgan-pacing.ts"),
    ("src/shared/realcugan-readback.ts",      "src/shared/realesrgan-readback.ts"),
    ("src/shared/realcugan-buffer-pool.ts",   "src/shared/realesrgan-buffer-pool.ts"),
    ("src/shared/realcugan-models.ts",        "src/shared/realesrgan-models.ts"),
    ("src/shared/realcugan-tensor.ts",        "src/shared/realesrgan-tensor.ts"),
    ("src/core/realcugan-compose.ts",         "src/core/realesrgan-compose.ts"),
    ("src/core/realcugan-session.ts",         "src/core/realesrgan-session.ts"),
    ("src/core/realcugan-browser-setup.ts",   "src/core/realesrgan-browser-setup.ts"),
    ("src/core/realcugan-worker-client.ts",   "src/core/realesrgan-worker-client.ts"),
    ("src/core/realcugan-pipeline.ts",        "src/core/realesrgan-pipeline.ts"),
    ("src/worker/realcugan-inference-worker.js", "src/worker/realesrgan-inference-worker.js"),
]

# Files whose x2 -> x4 scaling must be rewritten.
SCALE_FILES = {
    "src/shared/realesrgan-tensor.ts",
    "src/core/realesrgan-compose.ts",
    "src/core/realesrgan-pipeline.ts",
}

MODEL_FILE = "RealESR-AnimeVideo-v3_x4.onnx"


def git_show(path: str) -> str:
    return subprocess.check_output(["git", "show", f"{COMMIT}:{path}"]).decode("utf-8")


def transform(name: str, text: str) -> str:
    # Class / type / identifier renames (whole-word, case-sensitive).
    text = text.replace("RealCugan", "RealEsrgan")
    text = text.replace("RealCUGAN", "RealESRGAN")
    text = text.replace("realcugan", "realesrgan")
    text = text.replace("RealCuGan", "RealEsrGan")  # defensive

    # Model mapping file: point at the single RealESRGAN x4 model.
    if name.endswith("realesrgan-models.ts"):
        text = re.sub(
            r"export const REALCUGAN_CLASS_TO_MODEL_FILE.*?};",
            (
                "export const REALESRGAN_CLASS_TO_MODEL_FILE: Record<string, string> = {\n"
                "  RealEsrganX4: 'RealESR-AnimeVideo-v3_x4.onnx',\n"
                "};"
            ),
            text,
            flags=re.S,
        )
        text = text.replace(
            "export function realCuganModelFileForClass",
            "export function realEsrganModelFileForClass",
        )
        text = text.replace(
            "Unknown RealCUGAN pipeline class",
            "Unknown RealESRGAN pipeline class",
        )

    # Scaling factor 2 -> 4 only in the geometry math, not in comments about
    # "2x" descriptions where harmless. We rewrite the numeric multipliers and
    # the upscale-factor tokens specifically.
    if name in SCALE_FILES:
        # tile width/height * 2 -> * 4 (output scaling)
        text = text.replace("tile.width * 2", "tile.width * 4")
        text = text.replace("tile.height * 2", "tile.height * 4")
        text = text.replace("(tile.width * 2)", "(tile.width * 4)")
        text = text.replace("(tile.height * 2)", "(tile.height * 4)")
        text = text.replace("upW = tile.width * 2", "upW = tile.width * 4")
        text = text.replace("upH = tile.height * 2", "upH = tile.height * 4")
        text = text.replace("3 * (tile.width * 2) * (tile.height * 2)",
                             "3 * (tile.width * 4) * (tile.height * 4)")
        text = text.replace("tile.x * 2", "tile.x * 4")
        text = text.replace("tile.y * 2", "tile.y * 4")
        text = text.replace("width * 2", "width * 4")
        text = text.replace("height * 2", "height * 4")
        text = text.replace("outWidth: width * 2", "outWidth: width * 4")
        text = text.replace("outHeight: height * 2", "outHeight: height * 4")
        # output texture creation: inferenceWidth * 2 -> * 4
        text = text.replace("this.inferenceWidth * 2", "this.inferenceWidth * 4")
        text = text.replace("this.inferenceHeight * 2", "this.inferenceHeight * 4")
        # comments mentioning "2x-upscaled"
        text = text.replace("2x-upscaled tile", "4x-upscaled tile")
        text = text.replace("at 2x resolution", "at 4x resolution")
        text = text.replace("the 2x output", "the 4x output")
        text = text.replace("upscaled tile, channel-major, in [0,1]",
                             "4x-upscaled tile, channel-major, in [0,1]")

    # Browser setup: model dir + resolver name.
    if name.endswith("realesrgan-browser-setup.ts"):
        text = text.replace(
            "models/realcugan/${fileName}",
            "models/realesrgan/${fileName}",
        )
        text = text.replace(
            "setRealCuganModelUrlResolver", "setRealEsrganModelUrlResolver")
        text = text.replace(
            "setRealCuganThreadingConfig", "setRealEsrganThreadingConfig")

    # Session factory: resolver + threading + model-file helpers.
    if name.endswith("realesrgan-session.ts"):
        text = text.replace(
            "setRealCuganModelUrlResolver", "setRealEsrganModelUrlResolver")
        text = text.replace(
            "setRealCuganThreadingConfig", "setRealEsrganThreadingConfig")
        text = text.replace(
            "realCuganModelFileForClass", "realEsrganModelFileForClass")
        text = text.replace(
            "clearRealCuganSessionCache", "clearRealEsrganSessionCache")
        text = text.replace(
            "createRealCuganSession", "createRealEsrganSession")

    # Pipeline: session + browser-setup hook names.
    if name.endswith("realesrgan-pipeline.ts"):
        text = text.replace(
            "setRealCuganModelUrlResolver", "setRealEsrganModelUrlResolver")
        text = text.replace(
            "createRealCuganSession", "createRealEsrganSession")

    # Worker client: message/protocol is generic; only the data-url label.
    if name.endswith("realesrgan-worker-client.ts"):
        text = text.replace(
            "RealCUGAN inference worker", "RealESRGAN inference worker")

    # Worker script (.js): ORT bundle path + model fetch are generic; rename
    # only the self-label and any realcugan dir references.
    if name.endswith("realesrgan-inference-worker.js"):
        text = text.replace(
            "models/realcugan/", "models/realesrgan/")
        text = text.replace("realcugan", "realesrgan")
        text = text.replace("RealCUGAN", "RealESRGAN")

    return text


def main() -> None:
    for src, dst in FILES:
        text = git_show(src)
        out = transform(dst, text)
        with open(dst, "w", encoding="utf-8") as fh:
            fh.write(out)
        print(f"wrote {dst} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
