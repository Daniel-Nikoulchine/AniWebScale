/**
 * One-shot color diagnostic for the RealESRGAN path (405p report): channel
 * statistics of the inference input vs. the runner output on the first
 * frames, so a tint/shift can be attributed to one side of the transport.
 *
 * Pure sampling — no GPU, no state: the pipeline owns the one-shot flags and
 * the log cadence. Sampling mirrors the original inline loops exactly
 * (inner 30–70% box; planar input stepped every pixel, RGBA output stepped
 * every second pixel), so historic log lines stay comparable.
 */

export interface ColorChannelStats {
  meanR: number;
  meanG: number;
  meanB: number;
  /** Mean |R−G|: a tint shows up here before the means move. */
  meanRGDiff: number;
  sampled: number;
}

function boxBounds(width: number, height: number): { x0: number; x1: number; y0: number; y1: number } {
  return {
    y0: Math.floor(height * 0.3),
    y1: Math.floor(height * 0.7),
    x0: Math.floor(width * 0.3),
    x1: Math.floor(width * 0.7),
  };
}

/** Channel stats over planar NCHW RGB floats in [0,1]. */
export function colorDiagStatsFromPlanar(planar: Float32Array, width: number, height: number): ColorChannelStats {
  const pixels = width * height;
  if (planar.length < 3 * pixels) {
    throw new Error(`colorDiagStatsFromPlanar: need ${3 * pixels} floats, got ${planar.length}.`);
  }
  const { x0, x1, y0, y1 } = boxBounds(width, height);
  let ir = 0, ig = 0, ib = 0, irg = 0, n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = y * width + x;
      const r = planar[p];
      const g = planar[p + pixels];
      const b = planar[p + 2 * pixels];
      ir += r; ig += g; ib += b; irg += Math.abs(r - g); n += 1;
    }
  }
  if (n === 0) throw new Error('colorDiagStatsFromPlanar: empty sampling box.');
  return { meanR: ir / n, meanG: ig / n, meanB: ib / n, meanRGDiff: irg / n, sampled: n };
}

/** Channel stats over tightly packed RGBA8 (values quantised to [0,1] /255). */
export function colorDiagStatsFromRgba(rgba: Uint8Array, width: number, height: number): ColorChannelStats {
  if (rgba.length < width * height * 4) {
    throw new Error(`colorDiagStatsFromRgba: need ${width * height * 4} bytes, got ${rgba.length}.`);
  }
  const { x0, x1, y0, y1 } = boxBounds(width, height);
  let ir = 0, ig = 0, ib = 0, irg = 0, n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const o = (y * width + x) * 4;
      const r = rgba[o] / 255;
      const g = rgba[o + 1] / 255;
      const b = rgba[o + 2] / 255;
      ir += r; ig += g; ib += b; irg += Math.abs(r - g); n += 1;
    }
  }
  if (n === 0) throw new Error('colorDiagStatsFromRgba: empty sampling box.');
  return { meanR: ir / n, meanG: ig / n, meanB: ib / n, meanRGDiff: irg / n, sampled: n };
}

/** Console line, identical in shape to the pre-extraction inline logs. */
export function formatColorDiag(kind: 'in' | 'out', width: number, height: number, stats: ColorChannelStats): string {
  return '[RealESRGAN] colordiag ' + kind + '=%dx%d mean=%.3f/%.3f/%.3f rgdiff=%.4f'
    .replace('%dx%d', `${width}x${height}`)
    .replace('%.3f/%.3f/%.3f', `${stats.meanR.toFixed(3)}/${stats.meanG.toFixed(3)}/${stats.meanB.toFixed(3)}`)
    .replace('%.4f', stats.meanRGDiff.toFixed(4));
}
