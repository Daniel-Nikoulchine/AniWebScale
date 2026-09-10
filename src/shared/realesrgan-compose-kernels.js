/**
 * Canonical zero-import compose kernels for the RealESRGAN worker.
 *
 * The worker cannot import shared modules (Blob-URL load), so
 * scripts/generate-worker-tiling.mjs copies the marked region verbatim into
 * src/worker/realesrgan-inference-worker.js (<generated-compose-kernels>).
 * The pixel helpers these functions call (packedRgbaView, packRgbaWord) come
 * from realesrgan-pixels.js, which the worker carries as a separate generated
 * block; the import below exists for main-thread importers and tests and is
 * deliberately OUTSIDE the generated markers.
 */
import { packedRgbaView, packRgbaWord } from './realesrgan-pixels.js';

// <compose-kernels-begin>
export function extractTilePlanar(inputRgb, sourceWidth, sourceHeight, x, y, tileWidth, tileHeight) {
  const sourcePixels = sourceWidth * sourceHeight;
  const tilePixels = tileWidth * tileHeight;
  const out = new Float32Array(3 * tilePixels);
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
 * Stack per-tile planar data into one NCHW batch tensor backing array.
 * Tiles are uniform (see planUniformTiles), so the layout is simply
 * [B, 3, tileH, tileW] concatenated.
 */
export function stackTilesToBatch(inputRgb, sourceWidth, sourceHeight, tiles) {
  if (!tiles.length) throw new Error('Cannot batch an empty tile list.');
  if (!(inputRgb instanceof Float32Array) || inputRgb.length !== 3 * sourceWidth * sourceHeight) {
    throw new Error('Invalid planar input for tile batching.');
  }
  const tile = tiles[0];
  const tilePixels = tile.width * tile.height;
  const batch = new Float32Array(tiles.length * 3 * tilePixels);
  const sourcePixels = sourceWidth * sourceHeight;
  // Direct row copies into the batch backing (no per-tile intermediate
  // allocation + second copy: extractTilePlanar + batch.set touched every
  // tile pixel twice and GC'd a 3MB buffer per tile at 720p). Dimensions
  // stay the first tile's (uniform batches by construction), exactly like
  // the extractTilePlanar call this replaces.
  for (let b = 0; b < tiles.length; b += 1) {
    const t = tiles[b];
    const base = b * 3 * tilePixels;
    for (let c = 0; c < 3; c += 1) {
      const srcPlaneOffset = c * sourcePixels;
      const dstPlaneOffset = base + c * tilePixels;
      for (let row = 0; row < tile.height; row += 1) {
        const srcOffset = srcPlaneOffset + (t.y + row) * sourceWidth + t.x;
        batch.set(inputRgb.subarray(srcOffset, srcOffset + tile.width), dstPlaneOffset + row * tile.width);
      }
    }
  }
  return batch;
}

// --- CPU compose -------------------------------------------------------------



/**
 * CPU compose with the exact separable feathering math of
 * `composeTileResults` (integer ramps, weight = min(fx, fy), weighted
 * average), then pack to RGBA8. `tiles[i].rgb` is the tile's planar 4x
 * result. Runs when the GPU compose path is unavailable.
 */
export function composeTilesToRgba8(tiles, outWidth, outHeight, featherWindow) {
  const outPixels = outWidth * outHeight;
  const acc = new Float32Array(3 * outPixels);
  const weights = new Float32Array(outPixels);
  const rgba = new Uint8Array(4 * outPixels);
  const ramp = (length) => cachedFeatherRamp(length, featherWindow);
  for (const tile of tiles) {
    const upW = tile.width * 4;
    const upH = tile.height * 4;
    const baseX = tile.x * 4;
    const baseY = tile.y * 4;
    const fx = ramp(upW);
    const fy = ramp(upH);
    const tilePixels = upW * upH;
    const rgb = tile.rgb;
    for (let row = 0; row < upH; row += 1) {
      const wy = fy[row];
      const srcRow = row * upW;
      const outRowBase = (baseY + row) * outWidth + baseX;
      for (let col = 0; col < upW; col += 1) {
        const weight = Math.min(fx[col], wy);
        const srcIndex = srcRow + col;
        const outIndex = outRowBase + col;
        acc[outIndex] += rgb[srcIndex] * weight;
        acc[outPixels + outIndex] += rgb[tilePixels + srcIndex] * weight;
        acc[2 * outPixels + outIndex] += rgb[2 * tilePixels + srcIndex] * weight;
        weights[outIndex] += weight;
      }
    }
  }
  const words = packedRgbaView(rgba, outPixels);
  if (words) {
    for (let i = 0; i < outPixels; i += 1) {
      const w = weights[i] || 1;
      const vr = acc[i] / w;
      const vg = acc[outPixels + i] / w;
      const vb = acc[2 * outPixels + i] / w;
      words[i] = packRgbaWord(
        ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0,
        ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0,
        ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0,
      );
    }
    return rgba;
  }
  for (let i = 0; i < outPixels; i += 1) {
    const w = weights[i] || 1;
    // Branchless clamp + truncate-pack, bit-identical to the Math.round /
    // Math.min / Math.max chain (see realesrgan-tensor.ts).
    const vr = acc[i] / w;
    const vg = acc[outPixels + i] / w;
    const vb = acc[2 * outPixels + i] / w;
    rgba[i * 4] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
    rgba[i * 4 + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
    rgba[i * 4 + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

// Per-(length, window) feather ramps for the CPU compose above: tile
// geometries repeat every frame, so rebuilding the same ramps per tile per
// frame is pure GC churn. Read-only shares (compose only reads them).
const featherRampCache = new Map();
function cachedFeatherRamp(length, featherWindow) {
  const key = length * 4096 + featherWindow;
  const hit = featherRampCache.get(key);
  if (hit) return hit;
  const r = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    r[i] = Math.min(Math.min(i, length - 1 - i) + 1, featherWindow);
  }
  if (featherRampCache.size >= 64) featherRampCache.clear();
  // Shared read-only (see realesrgan-tensor.ts): no Object.freeze, it
  // throws on TypedArrays with elements — the guard would be the bug.
  featherRampCache.set(key, r);
  return r;
}

/** Slice a batched [B,3,4h,4w] planar float array into per-tile views. */
export function splitBatchedOutput(batched, tiles) {
  const upPixels = (tiles[0].width * 4) * (tiles[0].height * 4);
  return tiles.map((tile, b) => ({
    ...tile,
    rgb: batched.subarray(b * 3 * upPixels, (b + 1) * 3 * upPixels),
  }));
}

/**
 * Single-tile fast lane (Hebel E5b): no overlap exists, so the weighted
 * average is algebraically the input itself — convert + pack directly, no
 * accumulator, no weights, no divisions. Bit-identical across engines (no
 * fused multiply-add can form: scale + round only). The full lane stays for
 * multi-tile frames and as the fallback.
 */
export function composeSingleTileToRgba8(rgb, width, height) {
  const pixels = width * height;
  if (!(rgb instanceof Float32Array) || rgb.length !== 3 * pixels) {
    throw new Error(`Invalid single-tile planar input: expected ${3 * pixels} floats.`);
  }
  const rgba = new Uint8Array(4 * pixels);
  const words = packedRgbaView(rgba, pixels);
  if (words) {
    for (let i = 0; i < pixels; i += 1) {
      const vr = rgb[i];
      const vg = rgb[i + pixels];
      const vb = rgb[i + 2 * pixels];
      words[i] = packRgbaWord(
        ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0,
        ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0,
        ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0,
      );
    }
    return rgba;
  }
  for (let i = 0; i < pixels; i += 1) {
    const vr = rgb[i];
    const vg = rgb[i + pixels];
    const vb = rgb[i + 2 * pixels];
    rgba[i * 4] = ((vr <= 0 ? 0 : vr >= 1 ? 1 : vr) * 255 + 0.5) | 0;
    rgba[i * 4 + 1] = ((vg <= 0 ? 0 : vg >= 1 ? 1 : vg) * 255 + 0.5) | 0;
    rgba[i * 4 + 2] = ((vb <= 0 ? 0 : vb >= 1 ? 1 : vb) * 255 + 0.5) | 0;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/**
 * Exact area-average box downscale of packed RGBA8. Each destination pixel
 * averages the source pixels overlapped by its box, with fractional edge
 * coverage weighted in. Uniform regions stay exactly uniform; identity
 * dimensions return a copy. Mirrors the native host's transport-sized
 * output so worker and native frames match pixel for pixel — including the
 * alpha rule: output is always opaque (255), like the host's box pass.
 * Every production input is opaque already (all writers set alpha 255),
 * so this is bit-identical on real frames while keeping the two engines
 * aligned by construction instead of by input luck.
 */
export function downscaleRgba8Box(rgba, srcWidth, srcHeight, dstWidth, dstHeight) {
  const out = new Uint8Array(dstWidth * dstHeight * 4);
  // Integer fast lane for exact power-of-two factors (mirrors the native
  // host's tiled transport-downscale): every weight is exactly 1.0 over a
  // power-of-two area, so integer averaging is bit-identical to the float
  // box below while skipping per-pixel fractional math.
  const isPow2 = (v) => v > 0 && (v & (v - 1)) === 0;
  if (srcWidth % dstWidth === 0 && srcHeight % dstHeight === 0
      && isPow2(srcWidth / dstWidth) && isPow2(srcHeight / dstHeight)) {
    const fx = srcWidth / dstWidth;
    const fy = srcHeight / dstHeight;
    const area = fx * fy;
    const half = area / 2;
    for (let dy = 0; dy < dstHeight; dy += 1) {
      for (let dx = 0; dx < dstWidth; dx += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let sy = 0; sy < fy; sy += 1) {
          const srcRow = ((dy * fy + sy) * srcWidth + dx * fx) * 4;
          for (let sx = 0; sx < fx; sx += 1) {
            const srcOffset = srcRow + sx * 4;
            r += rgba[srcOffset];
            g += rgba[srcOffset + 1];
            b += rgba[srcOffset + 2];
          }
        }
        const dstOffset = (dy * dstWidth + dx) * 4;
        out[dstOffset] = (r + half) / area | 0;
        out[dstOffset + 1] = (g + half) / area | 0;
        out[dstOffset + 2] = (b + half) / area | 0;
        out[dstOffset + 3] = 255;
      }
    }
    return out;
  }
  for (let dy = 0; dy < dstHeight; dy += 1) {
    const yStart = (dy * srcHeight) / dstHeight;
    const yEnd = ((dy + 1) * srcHeight) / dstHeight;
    for (let dx = 0; dx < dstWidth; dx += 1) {
      const xStart = (dx * srcWidth) / dstWidth;
      const xEnd = ((dx + 1) * srcWidth) / dstWidth;
      let r = 0;
      let g = 0;
      let b = 0;
      let area = 0;
      for (let sy = Math.floor(yStart); sy < yEnd && sy < srcHeight; sy += 1) {
        const yOverlap = Math.min(sy + 1, yEnd) - Math.max(sy, yStart);
        for (let sx = Math.floor(xStart); sx < xEnd && sx < srcWidth; sx += 1) {
          const xOverlap = Math.min(sx + 1, xEnd) - Math.max(sx, xStart);
          const weight = xOverlap * yOverlap;
          const srcOffset = (sy * srcWidth + sx) * 4;
          r += rgba[srcOffset] * weight;
          g += rgba[srcOffset + 1] * weight;
          b += rgba[srcOffset + 2] * weight;
          area += weight;
        }
      }
      const dstOffset = (dy * dstWidth + dx) * 4;
      out[dstOffset] = Math.round(r / area);
      out[dstOffset + 1] = Math.round(g / area);
      out[dstOffset + 2] = Math.round(b / area);
      out[dstOffset + 3] = 255;
    }
  }
  return out;
}
// <compose-kernels-end>
