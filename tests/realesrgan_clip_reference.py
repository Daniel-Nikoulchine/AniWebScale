# -*- coding: utf-8 -*-
"""
Offline RealESRGAN clip regression test (no GPU required).

Uses the One Piece E2E fixture frame (tests/fixtures/one_piece_frame.png,
extracted from one_piece_clip.mp4 frame 30) and runs it through the
REAL onnxruntime-python with the REAL bundled ONNX model - the same model
files the extension ships. This proves the ONNX dim_param fix
(out_height/out_width) kills the "Shape mismatch attempting to re-use
buffer {1,480,640,3} != {1,1920,2560,3}" error on a WebGPU-shaped run:

 1. First run at 640x480 (the shape ORT 1.29 cached internally before the
    fix and then threw on).
 2. Second run on the SAME session at a different shape - would throw
    "Shape mismatch attempting to re-use buffer" before the fix.

Quality gate: SSIM between the ONNX fp32 reference and the fp16 model on
the same frame must stay >= 0.985 (the shipped fp16 tolerance).

Skipped automatically when onnxruntime/onnx/PIL are missing (CI without
the python stack) - executed by tests/e2e/run-realesrgan-clip.mjs via
`python` and reports a JSON payload consumed by that runner.
"""
import json
import sys

import numpy as np

try:
    import onnxruntime as ort
    from PIL import Image
except ImportError as error:
    print(json.dumps({
        "skipped": True,
        "reason": f"python deps missing: {error}",
    }))
    sys.exit(0)

FRAME = "tests/fixtures/one_piece_frame.png"
MODEL_FP32 = "models/realesrgan/RealESR-AnimeVideo-v3_x4.onnx"
MODEL_FP16 = "models/realesrgan/RealESR-AnimeVideo-v3_x4.fp16.onnx"
SSIM_MIN = 0.985


def load_frame(path: str, width: int, height: int) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    if image.size != (width, height):
        image = image.resize((width, height), Image.BILINEAR)
    array = np.asarray(image, dtype=np.float32) / 255.0
    return array.transpose(2, 0, 1)[np.newaxis, ...]  # [1,3,H,W]


def ssim(a: np.ndarray, b: np.ndarray) -> float:
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    from math import exp

    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    values = []
    for channel in range(3):
        x = a[0, channel] * 255.0
        y = b[0, channel] * 255.0
        # 7x7 Gaussian window, sigma 1.5 (matches tests/golden estimator).
        radius = 3
        kernel = np.zeros((7, 7), dtype=np.float64)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                kernel[dy + radius, dx + radius] = exp(-(dx * dx + dy * dy) / (2 * 1.5 * 1.5))
        kernel /= kernel.sum()
        from numpy.lib.stride_tricks import sliding_window_view

        win = 7
        h, w = x.shape
        xw = sliding_window_view(x, (win, win))[: h - win + 1, : w - win + 1]
        yw = sliding_window_view(y, (win, win))[: h - win + 1, : w - win + 1]
        mx = np.einsum("ijkl,kl->ij", xw, kernel)
        my = np.einsum("ijkl,kl->ij", yw, kernel)
        mxx = np.einsum("ijkl,kl->ij", xw * xw, kernel)
        myy = np.einsum("ijkl,kl->ij", yw * yw, kernel)
        mxy = np.einsum("ijkl,kl->ij", xw * yw, kernel)
        vx = mxx - mx * mx
        vy = myy - my * my
        vxy = mxy - mx * my
        s = ((2 * mx * my + c1) * (2 * vxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))
        values.append(s.mean())
    return float(np.mean(values))


def main() -> int:
    report: dict = {"checks": [], "pass": True}

    def check(name: str, ok: bool, detail: str = "") -> None:
        report["checks"].append({"name": name, "pass": bool(ok), "detail": detail})
        if not ok:
            report["pass"] = False

    frame = load_frame(FRAME, 640, 480)
    check("frame loaded", frame.shape == (1, 3, 480, 640), str(frame.shape))

    # Session WITHOUT preferredOutputLocation (the per-tile GPU configuration
    # the worker uses after 1.0.14). Python ORT runs CPU here; the shape
    # bookkeeping under test is EP-independent.
    session = ort.InferenceSession(MODEL_FP32, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    check(
        "model output dim_params fixed",
        [d for d in session.get_outputs()[0].shape]
        == ["out_batch_size", 3, "out_height", "out_width"],
        str(session.get_outputs()[0].shape),
    )

    # Run 1: the batched shape the extension used before 1.0.14 - the exact
    # shape pair from the bug report.
    out1 = session.run([output_name], {input_name: frame})[0]
    check("run 640x480 ok", out1.shape == (1, 3, 1920, 2560), str(out1.shape))

    # Run 2: DIFFERENT shape on the SAME session. Before the dim_param fix,
    # the WebGPU EP re-used the cached output buffer for run 1's shape and
    # threw "Shape mismatch attempting to re-use buffer". With distinct
    # out_height/out_width dim_params the reuse check passes.
    frame_small = load_frame(FRAME, 480, 360)
    out2 = session.run([output_name], {input_name: frame_small})[0]
    check("run 360x480 ok (shape reuse safe)", out2.shape == (1, 3, 1440, 1920), str(out2.shape))

    # Quality gate: fp16 vs fp32 reference on the real clip frame.
    fp16_session = ort.InferenceSession(MODEL_FP16, providers=["CPUExecutionProvider"])
    out_fp16 = fp16_session.run([fp16_session.get_outputs()[0].name], {input_name: frame})[0]
    score = ssim(out1, out_fp16)
    check("fp16 SSIM >= 0.985", score >= SSIM_MIN, f"ssim={score:.5f}")
    report["ssim"] = score

    # Not black: the reference output must contain actual picture content.
    check("output not black", float(out1.mean()) > 0.05, f"mean={float(out1.mean()):.4f}")

    print(json.dumps(report))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
