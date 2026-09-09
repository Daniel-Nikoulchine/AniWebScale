/**
 * Tensor plumbing for the RealESRGAN ONNX inference path.
 *
 * The ONNX model consumes planar NCHW RGB floats in [0,1] and returns planar
 * RGB floats at 4x resolution. Video frames arrive as packed RGBA bytes. This
 * module converts between the two layouts and composes overlapping inference
 * tiles back into a single full-size result, feathering tile borders so seams
 * are invisible.
 */
import { adaptiveRealEsrganTiling, featherWindowForOverlap, planRealEsrganTiles } from './realesrgan-tile-geometry.js';

export interface PlanarRgb {
  /** Channel-major floats in [0,1], length 3 * width * height. */
  data: Float32Array;
  channels: 3;
}

/** Byte -> [0,1] float with the exact `/ 255` rounding of the converters. */
let byteToF32Table: Float32Array | null = null;
function ensureByteToF32(): Float32Array {
  if (!byteToF32Table) {
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i += 1) table[i] = i / 255;
    byteToF32Table = table;
  }
  return byteToF32Table;
}

export function rgbaToPlanarRgb(rgba: Uint8Array, width: number, height: number): PlanarRgb {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`rgbaToPlanarRgb: invalid dimensions ${width}x${height}.`);
  }
  if (rgba.length < width * height * 4) {
    throw new Error(`rgbaToPlanarRgb: expected at least ${width * height * 4} bytes, got ${rgba.length}.`);
  }
  const pixels = width * height;
  const data = new Float32Array(3 * pixels);
  const r = data.subarray(0, pixels);
  const g = data.subarray(pixels, 2 * pixels);
  const b = data.subarray(2 * pixels, 3 * pixels);
  const lut = ensureByteToF32();
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    r[i] = lut[rgba[o]!]!;
    g[i] = lut[rgba[o + 1]!]!;
    b[i] = lut[rgba[o + 2]!]!;
  }
  return { data, channels: 3 };
}

export function rgbPlanarToRgba(planar: Float32Array, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`rgbPlanarToRgba: invalid dimensions ${width}x${height}.`);
  }
  if (planar.length < 3 * width * height) {
    throw new Error(`rgbPlanarToRgba: expected at least ${3 * width * height} floats, got ${planar.length}.`);
  }
  const pixels = width * height;
  const out = new Uint8Array(4 * pixels);
  const r = planar.subarray(0, pixels);
  const g = planar.subarray(pixels, 2 * pixels);
  const b = planar.subarray(2 * pixels, 3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    // Branchless clamp + truncate-pack: bit-identical to
    // Math.round(min(1, max(0, v)) * 255) for every float64 input (NaN and
    // infinities included — NaN fails both comparisons and packs to 0, just
    // like Math.round(NaN) stored into a Uint8Array), but without three
    // Math-call round trips per channel.
    const vr = r[i]!;
    const vg = g[i]!;
    const vb = b[i]!;
    const cr = vr <= 0 ? 0 : vr >= 1 ? 1 : vr;
    const cg = vg <= 0 ? 0 : vg >= 1 ? 1 : vg;
    const cb = vb <= 0 ? 0 : vb >= 1 ? 1 : vb;
    out[o] = (cr * 255 + 0.5) | 0;
    out[o + 1] = (cg * 255 + 0.5) | 0;
    out[o + 2] = (cb * 255 + 0.5) | 0;
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Fused pack + row-pad: write planar RGB floats directly into an RGBA byte
 * array whose rows are padded to `bytesPerRow` (WebGPU's writeTexture
 * alignment). One pass instead of `rgbPlanarToRgba` followed by a separate
 * padding copy. When `bytesPerRow` equals the tight row size the result is
 * exactly `rgbPlanarToRgba`.
 */
export function rgbPlanarToPaddedRgba(
  planar: Float32Array,
  width: number,
  height: number,
  bytesPerRow: number,
  out?: Uint8Array,
): Uint8Array {
  const pixels = width * height;
  const tightRowBytes = width * 4;
  if (bytesPerRow === tightRowBytes) {
    // Same out-buffer contract as the padded branch below: a caller-owned
    // buffer of the wrong size is an error, never a silent fresh allocation
    // (the caller would keep releasing/reading its stale buffer).
    if (out && out.length !== 4 * pixels) {
      throw new Error(`rgbPlanarToPaddedRgba: out buffer must hold ${4 * pixels} bytes, got ${out.length}.`);
    }
    if (out) {
      const r = planar.subarray(0, pixels);
      const g = planar.subarray(pixels, 2 * pixels);
      const b = planar.subarray(2 * pixels, 3 * pixels);
      for (let i = 0; i < pixels; i += 1) {
        const o = i * 4;
        const vr = r[i]!;
        const vg = g[i]!;
        const vb = b[i]!;
        out[o] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
        out[o + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
        out[o + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
        out[o + 3] = 255;
      }
      return out;
    }
    return rgbPlanarToRgba(planar, width, height);
  }
  const result = out ?? new Uint8Array(bytesPerRow * height);
  if (result.length !== bytesPerRow * height) {
    throw new Error(`rgbPlanarToPaddedRgba: out buffer must hold ${bytesPerRow * height} bytes, got ${result.length}.`);
  }
  const r = planar.subarray(0, pixels);
  const g = planar.subarray(pixels, 2 * pixels);
  const b = planar.subarray(2 * pixels, 3 * pixels);
  for (let row = 0; row < height; row += 1) {
    const rowBase = row * bytesPerRow;
    const pixelBase = row * width;
    for (let col = 0; col < width; col += 1) {
      const p = pixelBase + col;
      const o = rowBase + col * 4;
      const vr = r[p]!;
      const vg = g[p]!;
      const vb = b[p]!;
      result[o] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
      result[o + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
      result[o + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
      result[o + 3] = 255;
    }
  }
  return result;
}

export type TileInference = (
  tileRgb: Float32Array,
  tileWidth: number,
  tileHeight: number,
) => Promise<Float32Array>;

export interface ComposeOptions {
  inputRgb: Float32Array;
  width: number;
  height: number;
  maxTileSize: number;
  overlap: number;
  singleTileMaxHeight: number;
  infer: TileInference;
  /**
   * Optional preallocated output buffers (pooled across frames). Sizes must
   * match the 4x output: accumulator 3 * outWidth * outHeight floats,
   * weightSum outWidth * outHeight floats. Both are fully overwritten.
   */
  accumulator?: Float32Array;
  weightSum?: Float32Array;
}

export interface ComposedResult {
  rgb: Float32Array;
  width: number;
  height: number;
}

export function extractTileRgb(
  inputRgb: Float32Array,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
): Float32Array {
  const tilePixels = tileWidth * tileHeight;
  const out = new Float32Array(3 * tilePixels);
  const sourcePixels = sourceWidth * sourceHeight;
  for (let c = 0; c < 3; c += 1) {
    const srcPlane = inputRgb.subarray(c * sourcePixels, (c + 1) * sourcePixels);
    const dstPlane = out.subarray(c * tilePixels, (c + 1) * tilePixels);
    for (let row = 0; row < tileHeight; row += 1) {
      const srcOffset = (y + row) * sourceWidth + x;
      dstPlane.set(srcPlane.subarray(srcOffset, srcOffset + tileWidth), row * tileWidth);
    }
  }
  return out;
}

/**
 * Per-axis feather ramp: clamp(distance from edge + 1) to the window.
 *
 * Feathering weight for a pixel inside an upscaled tile grows from the tile
 * edge toward its centre over `featherWindow` output pixels, so where two
 * tiles overlap the interior of each wins and the seam is blended. The weight
 * is separable: min(fx[col], fy[row]) over these ramps reproduces the old
 * per-pixel `min(min(dx, dy) + 1, window)` exactly (integer arithmetic), so
 * the blended result is bit-identical while the inner loop does one Math.min.
 */
const featherRampCache = new Map<number, Float32Array>();

export function featherRamp(length: number, featherWindow: number): Float32Array {
  // Numeric key (no per-call string alloc): window is always < 4096.
  const key = length * 4096 + featherWindow;
  const hit = featherRampCache.get(key);
  if (hit) return hit;
  const ramp = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    ramp[i] = Math.min(Math.min(i, length - 1 - i) + 1, featherWindow);
  }
  // Geometries per pipeline are few (fixed inference dims + hysteretic
  // crops); the cap only guards against pathological size churn. Shared
  // read-only across frames/pipelines: callers must not mutate the
  // returned array (compose only reads — verified at every call site).
  // Deliberately NOT Object.freeze'd: freezing a TypedArray with elements
  // throws a TypeError at runtime, so the guard itself would be the bug
  // (proven by the compose suite when tried). The comment is the contract.
  if (featherRampCache.size >= 64) featherRampCache.clear();
  featherRampCache.set(key, ramp);
  return ramp;
}

export interface InferredTile {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Planar RGB floats of the 4x-4x-upscaled tile, channel-major, in [0,1]. */
  rgb: Float32Array;
}

export interface TiledInferenceResult {
  tiles: InferredTile[];
  featherWindow: number;
  outWidth: number;
  outHeight: number;
}

/**
 * Plan the tiles, extract each source tile, and run inference, returning the
 * per-tile upscaled results without composing them. Split out from
 * `composeTiledResult` so the caller can hand the tile results to either the
 * GPU composer or the CPU feathering pass without running inference twice.
 */
export async function inferTiledResults(options: ComposeOptions): Promise<TiledInferenceResult> {
  const { inputRgb, width, height, infer } = options;
  const geometry = adaptiveRealEsrganTiling(width, height, {
    maxTileSize: options.maxTileSize,
    overlap: options.overlap,
    singleTileMaxHeight: options.singleTileMaxHeight,
  });
  const plan = planRealEsrganTiles(width, height, geometry);
  // Canonical feather window: one formula for every compose engine (the
  // worker and pixels.wasm already derive theirs through the geometry module).
  const featherWindow = featherWindowForOverlap(geometry.overlap);
  const tiles: InferredTile[] = [];
  // Tile inference is intentionally SEQUENTIAL. Overlapping `run()` calls on
  // one shared session are unsafe: onnxruntime-web's WebGPU EP keeps a global
  // shape-pinned output buffer ("Shape mismatch attempting to re-use buffer"
  // fires across sessions on the same device), and concurrent runs on the
  // same session object corrupt its internal state. The worker path batches
  // (ONE run for the whole frame) or loops sequentially for the same reason;
  // the main-thread fallback serves few frames, so one run per tile in order
  // is correct and fast enough.
  for (const tile of plan.tiles) {
    const tileRgb = extractTileRgb(inputRgb, width, height, tile.x, tile.y, tile.width, tile.height);
    const rgb = await infer(tileRgb, tile.width, tile.height);
    tiles.push({ x: tile.x, y: tile.y, width: tile.width, height: tile.height, rgb });
  }
  return { tiles, featherWindow, outWidth: width * 4, outHeight: height * 4 };
}

/**
 * Feather already-inferred tiles into a single full-size result. Reproduces
 * the exact accumulation of the old inline loop (separable ramps, integer
 * weights, weighted average) so the CPU path stays bit-identical.
 */
export function composeTileResults(
  tiled: TiledInferenceResult,
  accumulator?: Float32Array,
  weightSum?: Float32Array,
): ComposedResult {
  const outWidth = tiled.outWidth;
  const outHeight = tiled.outHeight;
  const outPixels = outWidth * outHeight;
  const acc = accumulator ?? new Float32Array(3 * outPixels);
  if (acc.length !== 3 * outPixels) {
    throw new Error(`composeTileResults: accumulator must hold ${3 * outPixels} floats, got ${acc.length}.`);
  }
  const weights = weightSum ?? new Float32Array(outPixels);
  if (weights.length !== outPixels) {
    throw new Error(`composeTileResults: weightSum must hold ${outPixels} floats, got ${weights.length}.`);
  }
  // Pooled buffers carry stale data; both are fully overwritten below.
  acc.fill(0);
  weights.fill(0);
  const featherWindow = tiled.featherWindow;

  const rDst = acc.subarray(0, outPixels);
  const gDst = acc.subarray(outPixels, 2 * outPixels);
  const bDst = acc.subarray(2 * outPixels, 3 * outPixels);

  for (const tile of tiled.tiles) {
    const upW = tile.width * 4;
    const upH = tile.height * 4;
    const baseX = tile.x * 4;
    const baseY = tile.y * 4;

    // Separable feathering: min(fx[col], fy[row]) reproduces featherWeight
    // exactly (integer arithmetic), so the blended result is bit-identical to
    // the per-pixel version while the inner loop only does one Math.min.
    const fx = featherRamp(upW, featherWindow);
    const fy = featherRamp(upH, featherWindow);

    const tilePixels = upW * upH;
    const rSrc = tile.rgb.subarray(0, tilePixels);
    const gSrc = tile.rgb.subarray(tilePixels, 2 * tilePixels);
    const bSrc = tile.rgb.subarray(2 * tilePixels, 3 * tilePixels);

    for (let row = 0; row < upH; row += 1) {
      const wy = fy[row];
      const srcRow = row * upW;
      const outRowBase = (baseY + row) * outWidth + baseX;
      for (let col = 0; col < upW; col += 1) {
        const weight = Math.min(fx[col], wy);
        const srcIndex = srcRow + col;
        const outIndex = outRowBase + col;
        rDst[outIndex] += rSrc[srcIndex] * weight;
        gDst[outIndex] += gSrc[srcIndex] * weight;
        bDst[outIndex] += bSrc[srcIndex] * weight;
        weights[outIndex] += weight;
      }
    }
  }

  for (let i = 0; i < outPixels; i += 1) {
    const w = weights[i] || 1;
    acc[i] /= w;
    acc[outPixels + i] /= w;
    acc[2 * outPixels + i] /= w;
  }

  return { rgb: acc, width: outWidth, height: outHeight };
}

export async function composeTiledResult(options: ComposeOptions): Promise<ComposedResult> {
  const tiled = await inferTiledResults(options);
  return composeTileResults(tiled, options.accumulator, options.weightSum);
}
