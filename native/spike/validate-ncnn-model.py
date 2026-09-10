#!/usr/bin/env python3
"""Validate the ncnn-Vulkan RealESRGAN path against the ONNX reference.

Phase 2 of the Vulkan-only plan. Runs the pinned ONNX model
(models/realesrgan/RealESR-AnimeVideo-v3_x4.onnx, the same upstream weights as
the ncnn artifacts) with onnxruntime as the fp32 reference over the spike
output PNGs, then computes the same metrics as tests/golden/run_shader_golden.py
(SSIM 7x7 Gaussian sigma=1.5 on complete windows, RMSE, mean/max/p99 absolute
error on [0,1] RGB) and gates both storage modes against the official-shader
tolerances:

    SSIM >= 0.985, RMSE <= 0.035, p99 <= 0.135

Usage:
  python3 native/spike/validate-ncnn-model.py \
      --ncnn-fp32 syn_ncnn_fp32.png real_ncnn_fp32.png \
      --ncnn-fp16 syn_ncnn_fp16.png real_ncnn_fp16.png \
      --report artifacts/ncnn-vulkan-quality-report.json

Input PNGs are the 4x outputs of native/spike (build) ncnn-spike; the reference
is computed here from the *spike inputs*, which are recorded in the report as
--inputs (same order as the ncnn PNGs).
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ONNX_MODEL = ROOT / "models" / "realesrgan" / "RealESR-AnimeVideo-v3_x4.onnx"

DEFAULT_THRESHOLDS = {"minimum_ssim": 0.985, "maximum_rmse": 0.035, "maximum_p99_absolute": 0.135}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, nargs="+", required=True,
        help="Spike input images (pre-upscale), same order as the ncnn outputs")
    parser.add_argument("--ncnn-fp32", type=Path, nargs="+", required=True,
        help="ncnn-spike fp32-storage outputs, same order as --inputs")
    parser.add_argument("--ncnn-fp16", type=Path, nargs="+", default=[],
        help="ncnn-spike fp16-storage outputs, same order as --inputs")
    parser.add_argument("--report", type=Path, default=ROOT / "artifacts" / "ncnn-vulkan-quality-report.json")
    parser.add_argument("--work-dir", type=Path, default=ROOT / ".tmp" / "ncnn-vulkan-quality",
        help="Scratch directory for the reference PNGs")
    return parser.parse_args()


def percentile(values: np.ndarray, fraction: float) -> float:
    position = min(len(values) - 1, max(0, math.ceil(len(values) * fraction) - 1))
    return float(np.partition(values, position)[position])


def windowed_ssim(first: np.ndarray, second: np.ndarray) -> float:
    """7x7 Gaussian luminance SSIM (sigma=1.5), complete windows only.

    Same estimator as tests/golden/run_shader_golden.py so the quality gate is
    the one the project already publishes. Vectorised; identical maths.
    """
    radius = 3
    sigma = 1.5
    one_dimensional = np.array(
        [math.exp(-(o * o) / (2.0 * sigma * sigma)) for o in range(-radius, radius + 1)],
        dtype=np.float64,
    )
    normalizer = one_dimensional.sum() ** 2
    window = np.outer(one_dimensional, one_dimensional) / normalizer

    c1 = 0.01 ** 2
    c2 = 0.03 ** 2
    first_luma = first[..., 0] * 0.2126 + first[..., 1] * 0.7152 + first[..., 2] * 0.0722
    second_luma = second[..., 0] * 0.2126 + second[..., 1] * 0.7152 + second[..., 2] * 0.0722

    def stats(luma: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        mean = window_correlate(luma, window)
        variance = window_correlate(luma * luma, window) - mean * mean
        return mean, variance

    mean_first, var_first = stats(first_luma)
    mean_second, var_second = stats(second_luma)
    covariance = window_correlate(first_luma * second_luma, window) - mean_first * mean_second

    numerator = (2.0 * mean_first * mean_second + c1) * (2.0 * covariance + c2)
    denominator = (mean_first * mean_first + mean_second * mean_second + c1) * (var_first + var_second + c2)
    return float(np.mean(numerator / denominator))


def window_correlate(image: np.ndarray, window: np.ndarray) -> np.ndarray:
    """Complete-window weighted sums via sliding windows (no padding)."""
    radius = window.shape[0] // 2
    from numpy.lib.stride_tricks import sliding_window_view
    windows = sliding_window_view(image, window.shape)
    return np.einsum("ijkl,kl->ij", windows, window) if windows.ndim == 4 else (
        np.einsum("ijk,kl->ij", windows, window))


def onnx_reference(input_path: Path, output_path: Path, session) -> None:
    """Runs the pinned fp32 ONNX model on a spike input and writes a PNG."""
    image = Image.open(input_path).convert("RGB")
    width, height = image.size
    tensor = np.asarray(image, dtype=np.float32).transpose(2, 0, 1)[None] / np.float32(255.0)
    (result,) = session.run(None, {"input": tensor})
    result = np.clip(result[0], 0.0, 1.0)
    rgb8 = (result.transpose(1, 2, 0) * np.float32(255.0) + np.float32(0.5)).astype(np.uint8)
    Image.fromarray(rgb8).save(output_path)


def metrics(actual: np.ndarray, reference: np.ndarray) -> dict[str, float]:
    actual = np.clip(actual.astype(np.float64), 0.0, 1.0)
    reference = np.clip(reference.astype(np.float64), 0.0, 1.0)
    differences = np.abs(actual - reference).reshape(-1)
    return {
        "ssim": windowed_ssim(actual, reference),
        "rmse": float(np.sqrt(np.mean(differences * differences))),
        "mean_absolute": float(np.mean(differences)),
        "p99_absolute": percentile(differences, 0.99),
        "maximum_absolute": float(np.max(differences)),
    }


def passes(result: dict[str, float]) -> bool:
    return (
        result["ssim"] >= DEFAULT_THRESHOLDS["minimum_ssim"]
        and result["rmse"] <= DEFAULT_THRESHOLDS["maximum_rmse"]
        and result["p99_absolute"] <= DEFAULT_THRESHOLDS["maximum_p99_absolute"]
    )


def main() -> int:
    args = parse_args()
    if len(args.inputs) != len(args.ncnn_fp32):
        raise SystemExit("--inputs and --ncnn-fp32 must have the same length")
    if args.ncnn_fp16 and len(args.inputs) != len(args.ncnn_fp16):
        raise SystemExit("--inputs and --ncnn-fp16 must have the same length")

    import onnxruntime as ort
    session = ort.InferenceSession(str(ONNX_MODEL), providers=["CPUExecutionProvider"])

    args.work_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {
        "onnxModel": str(ONNX_MODEL),
        "thresholds": DEFAULT_THRESHOLDS,
        "cases": {},
    }
    all_passed = True

    for index, input_path in enumerate(args.inputs):
        case_name = input_path.stem
        reference_png = args.work_dir / f"{case_name}_onnx_fp32.png"
        onnx_reference(input_path, reference_png, session)
        reference = np.asarray(Image.open(reference_png).convert("RGB"), dtype=np.float32) / np.float32(255.0)

        case: dict[str, object] = {"reference": str(reference_png)}
        for label, paths in (("ncnnFp32", args.ncnn_fp32), ("ncnnFp16", args.ncnn_fp16)):
            if not paths:
                continue
            actual = np.asarray(Image.open(paths[index]).convert("RGB"), dtype=np.float32) / np.float32(255.0)
            if actual.shape != reference.shape:
                raise SystemExit(f"shape mismatch for {paths[index]}: {actual.shape} vs {reference.shape}")
            result = metrics(actual, reference)
            result["passed"] = passes(result)
            case[label] = result
            all_passed = all_passed and bool(result["passed"])
            print(
                f"{case_name} {label}: "
                f"SSIM {result['ssim']:.6f} RMSE {result['rmse']:.6f} "
                f"p99 {result['p99_absolute']:.6f} max {result['maximum_absolute']:.4f} "
                f"({'PASS' if result['passed'] else 'FAIL'})"
            )

        report["cases"][case_name] = case  # type: ignore[index]

    report["allPassed"] = all_passed
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"report: {args.report}")
    print(f"ncnn-vulkan quality: {'PASS' if all_passed else 'FAIL'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
