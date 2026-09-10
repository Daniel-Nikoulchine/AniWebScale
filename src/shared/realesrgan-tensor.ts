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
import { ensureByteToF32, packedRgbaView } from './realesrgan-pixels.js';

export interface PlanarRgb {
  /** Channel-major floats in [0,1], length 3 * width * height. */
  data: Float32Array;
  channels: 3;
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
  const words = packedRgbaView(rgba, pixels);
  if (words) {
    for (let i = 0; i < pixels; i += 1) {
      const word = words[i]!;
      r[i] = lut[word & 0xff]!;
      g[i] = lut[(word >>> 8) & 0xff]!;
      b[i] = lut[(word >>> 16) & 0xff]!;
    }
    return { data, channels: 3 };
  }
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    r[i] = lut[rgba[o]!]!;
    g[i] = lut[rgba[o + 1]!]!;
    b[i] = lut[rgba[o + 2]!]!;
  }
  return { data, channels: 3 };
}

/**
 * Single pack implementation behind `rgbPlanarToRgba` and
 * `rgbPlanarToPaddedRgba`: tightly packed rows are the
 * `bytesPerRow === width * 4` special case, so the branchless clamp +
 * truncate-pack rule exists once. `result` is caller-owned and exactly
 * `bytesPerRow * height` bytes.
 */
function packPlanarRgba(
  planar: Float32Array,
  width: number,
  height: number,
  bytesPerRow: number,
  result: Uint8Array,
): Uint8Array {
  const pixels = width * height;
  const r = planar.subarray(0, pixels);
  const g = planar.subarray(pixels, 2 * pixels);
  const b = planar.subarray(2 * pixels, 3 * pixels);
  // Branchless clamp + truncate-pack: bit-identical to
  // Math.round(min(1, max(0, v)) * 255) for every float64 input (NaN and
  // infinities included — NaN fails both comparisons and packs to 0). The
  // u32 lane collapses four byte stores into one 32-bit store per pixel; the
  // branch is hoisted out of the loop because a per-pixel check is slower
  // than the stores it guards.
  const words = packedRgbaView(result, (bytesPerRow * height) / 4);
  if (words) {
    const rowWords = bytesPerRow / 4;
    for (let row = 0; row < height; row += 1) {
      const pixelBase = row * width;
      const wordBase = row * rowWords;
      for (let col = 0; col < width; col += 1) {
        const p = pixelBase + col;
        const vr = r[p]!;
        const vg = g[p]!;
        const vb = b[p]!;
        words[wordBase + col] = ((((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0)
          | ((((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0) << 8)
          | ((((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0) << 16)
          | 0xff000000) >>> 0;
      }
    }
    return result;
  }
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

export function rgbPlanarToRgba(planar: Float32Array, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`rgbPlanarToRgba: invalid dimensions ${width}x${height}.`);
  }
  if (planar.length < 3 * width * height) {
    throw new Error(`rgbPlanarToRgba: expected at least ${3 * width * height} floats, got ${planar.length}.`);
  }
  return packPlanarRgba(planar, width, height, width * 4, new Uint8Array(4 * width * height));
}

/**
 * Fused pack + row-pad: write planar RGB floats directly into an RGBA byte
 * array whose rows are padded to `bytesPerRow` (WebGPU's writeTexture
 * alignment). One pass instead of `rgbPlanarToRgba` followed by a separate
 * padding copy. When `bytesPerRow` equals the tight row size the result is
 * exactly `rgbPlanarToRgba`.
 *
 * A caller-owned `out` buffer of the wrong size is an error, never a silent
 * fresh allocation (the caller would keep releasing/reading its stale buffer):
 * tight rows need `4 * width * height` bytes, padded rows
 * `bytesPerRow * height`.
 */
export function rgbPlanarToPaddedRgba(
  planar: Float32Array,
  width: number,
  height: number,
  bytesPerRow: number,
  out?: Uint8Array,
): Uint8Array {
  const expected = bytesPerRow * height;
  const result = out ?? new Uint8Array(expected);
  if (result.length !== expected) {
    throw new Error(`rgbPlanarToPaddedRgba: out buffer must hold ${expected} bytes, got ${result.length}.`);
  }
  return packPlanarRgba(planar, width, height, bytesPerRow, result);
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

/**
 * Extract a rectangular tile from a channel-major planar frame. Exported
 * because bench/tensor.bench.ts drives it directly (the worker has its own
 * generated equivalent).
 */
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
 * `composeTileResults` so the caller can hand the tile results to either the
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
 * True when the tiled result is exactly one full-cover tile — the case
 * `composeTileResults` handles without any accumulator/weight buffers. Callers
 * use it to skip acquiring those (large) pooled buffers at all.
 */
export function isSingleFullCoverTile(tiled: TiledInferenceResult): boolean {
  if (tiled.tiles.length !== 1) return false;
  const tile = tiled.tiles[0]!;
  return tile.x === 0 && tile.y === 0
    && tile.width * 4 === tiled.outWidth && tile.height * 4 === tiled.outHeight
    && tile.rgb.length === 3 * tiled.outWidth * tiled.outHeight;
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
  // Single-tile fast lane: with one tile the separable feather weight cancels
  // in the weighted average, so the composed result is the tile's own planar
  // data. Skips the full-size accumulator fill, the per-pixel accumulation
  // and the division pass — the dominant CPU cost of the main-thread fallback,
  // which runs one tile by construction at the 480p cap (singleTileMaxHeight
  // 512/576). Mirrors the worker's composeSingleTileToRgba8 lane; the tiny
  // float rounding difference is the same one that lane already accepts.
  if (isSingleFullCoverTile(tiled)) {
    return { rgb: tiled.tiles[0]!.rgb, width: outWidth, height: outHeight };
  }
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

