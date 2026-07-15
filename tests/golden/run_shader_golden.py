#!/usr/bin/env python3
"""Run the pinned GLSL, WebGPU, and D3D11 Anime4K graphs and compare pixels.

This is intentionally a hardware/integration test, not part of the fast unit
suite. It uses the checked-in official mpv hook shaders as the independent
oracle through FFmpeg/libplacebo. No reference pixels are generated from the
WGSL or HLSL ports themselves.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import statistics
import struct
import subprocess
import sys
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
SOURCE_WIDTH = 96
SOURCE_HEIGHT = 54
TARGET_WIDTH = 192
TARGET_HEIGHT = 108
FOUR_X_WIDTH = 384
FOUR_X_HEIGHT = 216
MODES = ("A", "B", "C", "AA", "BB", "CA")
REPEATED_MODES = ("AA", "BB", "CA")
QUALITIES = ("M", "VL", "UL")

DEFAULT_THRESHOLDS = {
    "official": {"minimum_ssim": 0.985, "maximum_rmse": 0.035, "maximum_p99_absolute": 0.13},
    "cross_backend": {"minimum_ssim": 0.995, "maximum_rmse": 0.015, "maximum_p99_absolute": 0.07},
}
# Fixed regression budgets. They cover the documented half-float storage and
# cross-API sampler-rounding boundary without permitting the rejected FP16 CNN
# arithmetic experiment (which fell as low as 0.888 SSIM against the oracle).


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-exe", type=Path, required=True, help="Built Anime4K.Golden.exe")
    parser.add_argument(
        "--work-dir", type=Path, default=ROOT / ".tmp" / "shader-golden" / "run",
        help="Scratch/output directory (default: .tmp/shader-golden/run)",
    )
    parser.add_argument(
        "--report", type=Path, default=ROOT / "artifacts" / "shader-golden-report.json",
        help="Machine-readable result report",
    )
    parser.add_argument("--warp", action="store_true", help="Use D3D11 WARP instead of the hardware adapter")
    return parser.parse_args()


def run(command: list[str], *, cwd: Path = ROOT, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(
        command, cwd=cwd, text=True, capture_output=True, check=False,
        env=env if env is not None else os.environ.copy(),
    )
    if result.returncode != 0:
        rendered = subprocess.list2cmdline(command)
        raise RuntimeError(
            f"Command failed ({result.returncode}): {rendered}\n{result.stdout}{result.stderr}"
        )
    return (result.stdout + result.stderr).strip()


def make_fixture() -> bytes:
    pixels = bytearray(SOURCE_WIDTH * SOURCE_HEIGHT * 4)
    for y in range(SOURCE_HEIGHT):
        for x in range(SOURCE_WIDTH):
            offset = (y * SOURCE_WIDTH + x) * 4
            # Anime-like fixture: flat fills, smooth gradients, high-contrast
            # one-pixel line art, a curved outline, and a small texture patch.
            red = 38 + x * 150 // (SOURCE_WIDTH - 1)
            green = 34 + y * 130 // (SOURCE_HEIGHT - 1)
            blue = 142 - x * 72 // (SOURCE_WIDTH - 1) + y * 24 // (SOURCE_HEIGHT - 1)
            distance_squared = (x - 34) ** 2 + (y - 27) ** 2
            if distance_squared < 15 ** 2:
                red, green, blue = 224, 166, 137
            if 13 ** 2 <= distance_squared <= 15 ** 2:
                red, green, blue = 24, 22, 31
            if abs(y * 3 - x - 22) <= 2 or (64 <= x <= 88 and 11 <= y <= 29 and (x in (64, 88) or y in (11, 29))):
                red, green, blue = 12, 14, 24
            if 67 <= x < 88 and 13 <= y < 28:
                red, green, blue = 52, 109, 188
            if 72 <= x < 92 and 36 <= y < 50:
                checker = ((x - 72) // 3 + (y - 36) // 3) & 1
                red, green, blue = ((225, 218, 196) if checker else (58, 62, 82))
            texture = ((x * 37 + y * 17) % 7) - 3
            pixels[offset + 0] = min(255, max(0, red + texture))
            pixels[offset + 1] = min(255, max(0, green + texture))
            pixels[offset + 2] = min(255, max(0, blue + texture))
            pixels[offset + 3] = 0xFF
    return bytes(pixels)


def ffmpeg_filter_path(path: Path) -> str:
    # FFmpeg filtergraphs interpret the Windows drive colon even when argv is
    # passed without a shell. Forward slashes plus an escaped colon are stable.
    value = path.resolve().as_posix().replace(":", r"\:").replace("'", r"\'")
    return f"'{value}'"


def generate_official_references(ffmpeg: str, work_dir: Path) -> dict[str, str]:
    manifest_path = ROOT / "native" / "generated-models" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    effects = {
        effect["id"]: effect
        for effect in (*manifest["shared_effects"], *manifest["effect_variants"])
    }
    presets = {(preset["mode"], preset["quality"]): preset for preset in manifest["presets"]}
    shader_root = ROOT / "native" / "third_party" / "anime4k"
    reference_dir = work_dir / "official-glsl"
    hook_dir = work_dir / "official-hooks"
    reference_dir.mkdir(parents=True, exist_ok=True)
    hook_dir.mkdir(parents=True, exist_ok=True)
    input_path = work_dir / "fixture-96x54.rgba8"
    input_path.write_bytes(make_fixture())
    shader_hashes: dict[str, str] = {}

    # Prove that FFmpeg/libplacebo is not silently applying a transfer function,
    # range conversion, or RGBA channel reorder before it acts as the oracle.
    identity_path = reference_dir / "identity-transport.rgba16unorm"
    identity_filter = (
        f"hwupload,libplacebo=w={SOURCE_WIDTH}:h={SOURCE_HEIGHT}:format=rgba64le:"
        "skip_aa=1:disable_linear=1:disable_builtin=1,hwdownload,format=rgba64le"
    )
    run([
        ffmpeg,
        "-hide_banner", "-loglevel", "error",
        "-init_hw_device", "vulkan=anime4k:0",
        "-filter_hw_device", "anime4k",
        "-f", "rawvideo", "-pixel_format", "rgba",
        "-video_size", f"{SOURCE_WIDTH}x{SOURCE_HEIGHT}",
        "-i", str(input_path),
        "-frames:v", "1", "-vf", identity_filter,
        "-f", "rawvideo", "-y", str(identity_path),
    ])
    expected_identity = b"".join(struct.pack("<H", value * 257) for value in input_path.read_bytes())
    if identity_path.read_bytes() != expected_identity:
        raise RuntimeError("FFmpeg/libplacebo identity transport changed range, transfer, or channel order")

    for mode in MODES:
        for quality in QUALITIES:
            preset = presets[(mode, quality)]
            chunks: list[str] = []
            for invocation, effect_id in enumerate(preset["effects"]):
                effect = effects[effect_id]
                source = shader_root / effect["source"]
                chunks.append(
                    f"\n// golden invocation {invocation}: {effect_id}\n"
                    + source.read_text(encoding="utf-8")
                    + "\n"
                )
            combined = "".join(chunks)
            key = f"{mode}_{quality}"
            hook_path = hook_dir / f"{key}.glsl"
            hook_path.write_text(combined, encoding="utf-8", newline="\n")
            shader_hashes[key] = hashlib.sha256(combined.encode("utf-8")).hexdigest()
            output_path = reference_dir / f"{key}.rgba16unorm"
            filtergraph = (
                "hwupload,"
                f"libplacebo=w={TARGET_WIDTH}:h={TARGET_HEIGHT}:format=rgba64le:"
                f"custom_shader_path={ffmpeg_filter_path(hook_path)}:"
                "skip_aa=1:disable_linear=1:disable_builtin=1,"
                "hwdownload,format=rgba64le"
            )
            run([
                ffmpeg,
                "-hide_banner", "-loglevel", "error",
                "-init_hw_device", "vulkan=anime4k:0",
                "-filter_hw_device", "anime4k",
                "-f", "rawvideo", "-pixel_format", "rgba",
                "-video_size", f"{SOURCE_WIDTH}x{SOURCE_HEIGHT}",
                "-i", str(input_path),
                "-frames:v", "1", "-vf", filtergraph,
                "-f", "rawvideo", "-y", str(output_path),
            ])
            expected = TARGET_WIDTH * TARGET_HEIGHT * 8
            if output_path.stat().st_size != expected:
                raise RuntimeError(f"Official {mode}/{quality} output has an invalid size")
            print(f"Official GLSL {mode}/{quality}")

    for mode in REPEATED_MODES:
        for quality in QUALITIES:
            key = f"{mode}_{quality}"
            hook_path = hook_dir / f"{key}.glsl"
            output_path = reference_dir / f"{key}_4x.rgba16unorm"
            filtergraph = (
                "hwupload,"
                f"libplacebo=w={FOUR_X_WIDTH}:h={FOUR_X_HEIGHT}:format=rgba64le:"
                f"custom_shader_path={ffmpeg_filter_path(hook_path)}:"
                "skip_aa=1:disable_linear=1:disable_builtin=1,"
                "hwdownload,format=rgba64le"
            )
            run([
                ffmpeg,
                "-hide_banner", "-loglevel", "error",
                "-init_hw_device", "vulkan=anime4k:0",
                "-filter_hw_device", "anime4k",
                "-f", "rawvideo", "-pixel_format", "rgba",
                "-video_size", f"{SOURCE_WIDTH}x{SOURCE_HEIGHT}",
                "-i", str(input_path),
                "-frames:v", "1", "-vf", filtergraph,
                "-f", "rawvideo", "-y", str(output_path),
            ])
            expected = FOUR_X_WIDTH * FOUR_X_HEIGHT * 8
            if output_path.stat().st_size != expected:
                raise RuntimeError(f"Official {mode}/{quality} 4x output has an invalid size")
            shader_hashes[f"{key}_4x"] = shader_hashes[key]
            print(f"Official GLSL {mode}/{quality} 4x")

    # Repeated hooks must not be deduplicated by the oracle. A+A/B+B add a
    # second restore invocation; C+A adds restore after denoise-upscale.
    for quality in QUALITIES:
        for single, repeated in (("A", "AA"), ("B", "BB"), ("C", "CA")):
            first = (reference_dir / f"{single}_{quality}.rgba16unorm").read_bytes()
            second = (reference_dir / f"{repeated}_{quality}.rgba16unorm").read_bytes()
            if first == second:
                raise RuntimeError(f"Official oracle did not preserve repeated graph {repeated}/{quality}")
    return shader_hashes


def run_native(native_exe: Path, input_path: Path, work_dir: Path, warp: bool) -> None:
    if not native_exe.is_file():
        raise FileNotFoundError(f"Native golden executable does not exist: {native_exe}")
    output_dir = work_dir / "d3d11"
    output_dir.mkdir(parents=True, exist_ok=True)
    command = [
        str(native_exe.resolve()), "--input", str(input_path), "--output-dir", str(output_dir),
    ]
    if warp:
        command.append("--warp")
    output = run(command)
    if output:
        print(output)


def run_webgpu(input_path: Path, work_dir: Path) -> str:
    webpack = ROOT / "node_modules" / ".bin" / ("webpack.cmd" if os.name == "nt" else "webpack")
    if not webpack.is_file():
        raise FileNotFoundError("Local webpack is missing; run npm ci (no network download is attempted here)")
    run([str(webpack), "--config", "tests/golden/webpack.config.cjs"])
    output_dir = work_dir / "webgpu"
    output_dir.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    local_browsers = ROOT / ".tmp" / "ms-playwright"
    if local_browsers.is_dir():
        environment["PLAYWRIGHT_BROWSERS_PATH"] = str(local_browsers)
    output = run(
        [
            "node", "tests/golden/run-webgpu.mjs", "--input", str(input_path),
            "--output-dir", str(output_dir),
        ],
        env=environment,
    )
    if output:
        print(output)
    adapter_path = output_dir / "adapter.txt"
    return adapter_path.read_text(encoding="utf-8").strip() if adapter_path.is_file() else "unknown"


def decode_half_rgba(
    path: Path, width: int = TARGET_WIDTH, height: int = TARGET_HEIGHT
) -> list[tuple[float, float, float]]:
    data = path.read_bytes()
    expected = width * height * 8
    if len(data) != expected:
        raise RuntimeError(f"{path} has {len(data)} bytes; expected {expected}")
    values = struct.unpack(f"<{width * height * 4}e", data)
    pixels = []
    for offset in range(0, len(values), 4):
        rgb = tuple(float(values[offset + channel]) for channel in range(3))
        if not all(math.isfinite(value) for value in rgb):
            raise RuntimeError(f"{path} contains non-finite output")
        pixels.append(rgb)
    return pixels


def decode_unorm16_rgba(
    path: Path, width: int = TARGET_WIDTH, height: int = TARGET_HEIGHT
) -> list[tuple[float, float, float]]:
    data = path.read_bytes()
    expected = width * height * 8
    if len(data) != expected:
        raise RuntimeError(f"{path} has {len(data)} bytes; expected {expected}")
    values = struct.unpack(f"<{width * height * 4}H", data)
    return [
        tuple(values[offset + channel] / 65535.0 for channel in range(3))
        for offset in range(0, len(values), 4)
    ]


def clipped(values: Iterable[tuple[float, float, float]]) -> list[tuple[float, float, float]]:
    return [tuple(min(1.0, max(0.0, channel)) for channel in pixel) for pixel in values]


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = min(len(ordered) - 1, max(0, math.ceil(len(ordered) * fraction) - 1))
    return ordered[position]


def luminance(pixel: tuple[float, float, float]) -> float:
    return pixel[0] * 0.2126 + pixel[1] * 0.7152 + pixel[2] * 0.0722


def windowed_ssim(
    first: list[tuple[float, float, float]],
    second: list[tuple[float, float, float]],
    width: int,
    height: int,
) -> float:
    # 7x7 normalized Gaussian windows, sigma=1.5. Only complete windows are
    # evaluated so an implementation cannot hide border errors through padding.
    radius = 3
    sigma = 1.5
    one_dimensional = [math.exp(-(offset * offset) / (2.0 * sigma * sigma)) for offset in range(-radius, radius + 1)]
    normalizer = sum(one_dimensional) ** 2
    windows: list[float] = []
    c1 = 0.01 ** 2
    c2 = 0.03 ** 2
    first_luma = [luminance(pixel) for pixel in first]
    second_luma = [luminance(pixel) for pixel in second]
    for y in range(radius, height - radius):
        for x in range(radius, width - radius):
            samples: list[tuple[float, float, float]] = []
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    weight = one_dimensional[dx + radius] * one_dimensional[dy + radius] / normalizer
                    index = (y + dy) * width + x + dx
                    samples.append((weight, first_luma[index], second_luma[index]))
            mean_first = sum(weight * value for weight, value, _ in samples)
            mean_second = sum(weight * value for weight, _, value in samples)
            variance_first = sum(weight * (value - mean_first) ** 2 for weight, value, _ in samples)
            variance_second = sum(weight * (value - mean_second) ** 2 for weight, _, value in samples)
            covariance = sum(
                weight * (value_first - mean_first) * (value_second - mean_second)
                for weight, value_first, value_second in samples
            )
            numerator = (2.0 * mean_first * mean_second + c1) * (2.0 * covariance + c2)
            denominator = (mean_first * mean_first + mean_second * mean_second + c1) * (
                variance_first + variance_second + c2
            )
            windows.append(numerator / denominator)
    return statistics.fmean(windows)


def metrics(
    actual: list[tuple[float, float, float]],
    reference: list[tuple[float, float, float]],
    width: int = TARGET_WIDTH,
    height: int = TARGET_HEIGHT,
) -> dict[str, float]:
    actual = clipped(actual)
    reference = clipped(reference)
    differences = [
        abs(actual[index][channel] - reference[index][channel])
        for index in range(len(actual))
        for channel in range(3)
    ]
    return {
        "ssim": windowed_ssim(actual, reference, width, height),
        "rmse": math.sqrt(statistics.fmean(value * value for value in differences)),
        "mean_absolute": statistics.fmean(differences),
        "p99_absolute": percentile(differences, 0.99),
        "maximum_absolute": max(differences),
    }


def passes(result: dict[str, float], threshold: dict[str, float]) -> bool:
    return (
        result["ssim"] >= threshold["minimum_ssim"]
        and result["rmse"] <= threshold["maximum_rmse"]
        and result["p99_absolute"] <= threshold["maximum_p99_absolute"]
    )


def compare(work_dir: Path, shader_hashes: dict[str, str], adapter: str, warp: bool) -> dict[str, object]:
    comparisons: dict[str, object] = {}
    four_x_comparisons: dict[str, object] = {}
    all_passed = True

    def compare_case(key: str, width: int, height: int, suffix: str, label: str) -> dict[str, object]:
        official = decode_unorm16_rgba(
            work_dir / "official-glsl" / f"{key}{suffix}.rgba16unorm", width, height
        )
        webgpu = decode_half_rgba(work_dir / "webgpu" / f"{key}{suffix}.rgba16f", width, height)
        d3d11 = decode_half_rgba(work_dir / "d3d11" / f"{key}{suffix}.rgba16f", width, height)
        webgpu_official = metrics(webgpu, official, width, height)
        d3d11_official = metrics(d3d11, official, width, height)
        cross_backend = metrics(webgpu, d3d11, width, height)
        result: dict[str, object] = {
            "officialShaderSha256": shader_hashes[f"{key}{suffix}"],
            "webgpuVsOfficial": webgpu_official,
            "d3d11VsOfficial": d3d11_official,
            "webgpuVsD3d11": cross_backend,
            "passed": (
                passes(webgpu_official, DEFAULT_THRESHOLDS["official"])
                and passes(d3d11_official, DEFAULT_THRESHOLDS["official"])
                and passes(cross_backend, DEFAULT_THRESHOLDS["cross_backend"])
            ),
        }
        print(
            f"{label}: "
            f"WGSL-official SSIM {webgpu_official['ssim']:.6f}, "
            f"D3D-official SSIM {d3d11_official['ssim']:.6f}, "
            f"cross SSIM {cross_backend['ssim']:.6f} "
            f"({'PASS' if result['passed'] else 'FAIL'})"
        )
        return result

    for mode in MODES:
        for quality in QUALITIES:
            key = f"{mode}_{quality}"
            result = compare_case(key, TARGET_WIDTH, TARGET_HEIGHT, "", f"{mode}/{quality}")
            comparisons[key] = result
            all_passed = all_passed and bool(result["passed"])
    for mode in REPEATED_MODES:
        for quality in QUALITIES:
            key = f"{mode}_{quality}"
            result = compare_case(
                key, FOUR_X_WIDTH, FOUR_X_HEIGHT, "_4x", f"{mode}/{quality} 4x"
            )
            four_x_comparisons[key] = result
            all_passed = all_passed and bool(result["passed"])

    manifest = json.loads((ROOT / "native" / "generated-models" / "manifest.json").read_text(encoding="utf-8"))
    return {
        "schemaVersion": 2,
        "passed": all_passed,
        "fixture": {
            "source": f"deterministic-rgba8-{SOURCE_WIDTH}x{SOURCE_HEIGHT}",
            "targets": {
                "twoX": f"{TARGET_WIDTH}x{TARGET_HEIGHT}",
                "fourX": f"{FOUR_X_WIDTH}x{FOUR_X_HEIGHT}",
            },
            "comparisonChannels": "clamped RGB",
            "sha256": hashlib.sha256(make_fixture()).hexdigest(),
        },
        "officialReference": {
            "implementation": "pinned upstream mpv GLSL executed by FFmpeg/libplacebo/Vulkan",
            "repository": manifest["anime4k_source"]["repository"],
            "commit": manifest["anime4k_source"]["commit"],
            "identityTransportVerified": True,
            "manifestSha256": hashlib.sha256(
                (ROOT / "native" / "generated-models" / "manifest.json").read_bytes()
            ).hexdigest(),
        },
        "backends": {
            "webgpuAdapter": adapter,
            "d3d11Adapter": "WARP" if warp else "default hardware adapter",
        },
        "thresholds": DEFAULT_THRESHOLDS,
        "ssim": "7x7 Gaussian luminance SSIM (sigma 1.5, complete windows)",
        "comparisons": comparisons,
        "fourXComparisons": four_x_comparisons,
    }


def main() -> int:
    args = parse_args()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise FileNotFoundError("FFmpeg with the libplacebo filter is required and was not found on PATH")
    filters = run([ffmpeg, "-hide_banner", "-filters"])
    if " libplacebo " not in filters:
        raise RuntimeError("The installed FFmpeg does not include the libplacebo filter")

    work_dir = args.work_dir.resolve()
    allowed_root = (ROOT / ".tmp").resolve()
    if work_dir != allowed_root and allowed_root not in work_dir.parents:
        raise RuntimeError(f"--work-dir must stay below {allowed_root}")
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True)
    shader_hashes = generate_official_references(ffmpeg, work_dir)
    input_path = work_dir / "fixture-96x54.rgba8"
    run_native(args.native_exe.resolve(), input_path, work_dir, args.warp)
    adapter = run_webgpu(input_path, work_dir)
    report = compare(work_dir, shader_hashes, adapter, args.warp)
    report["backends"]["d3d11ExecutableSha256"] = hashlib.sha256(
        args.native_exe.resolve().read_bytes()
    ).hexdigest()
    webgpu_bundle = ROOT / ".tmp" / "shader-golden" / "webgpu" / "webgpu-golden.js"
    report["backends"]["webgpuBundleSha256"] = hashlib.sha256(webgpu_bundle.read_bytes()).hexdigest()
    report["officialReference"]["ffmpegVersion"] = run([ffmpeg, "-version"]).splitlines()[0]
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Report: {args.report.resolve()}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # Integration failures should stay concise in CI.
        print(f"shader-golden: {error}", file=sys.stderr)
        raise SystemExit(2)
