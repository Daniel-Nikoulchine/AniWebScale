import { describe, expect, it } from 'vitest';
import {
  rgbaToPlanarRgb,
  rgbPlanarToRgba,
  rgbPlanarToPaddedRgba,
  composeTileResults,
  isSingleFullCoverTile,
  featherRamp,
  type TiledInferenceResult,
} from '../src/shared/realesrgan-tensor';
import { planUpload } from '../src/shared/realesrgan-readback';

function refRgbToRgba(planar: Float32Array, width: number, height: number): Uint8Array {
  const pixels = width * height;
  const out = new Uint8Array(4 * pixels);
  const r = planar.subarray(0, pixels);
  const g = planar.subarray(pixels, 2 * pixels);
  const b = planar.subarray(2 * pixels, 3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    out[o] = Math.round(Math.min(1, Math.max(0, r[i]!)) * 255);
    out[o + 1] = Math.round(Math.min(1, Math.max(0, g[i]!)) * 255);
    out[o + 2] = Math.round(Math.min(1, Math.max(0, b[i]!)) * 255);
    out[o + 3] = 255;
  }
  return out;
}

function refRgbaToPlanar(rgba: Uint8Array, width: number, height: number): Float32Array {
  const pixels = width * height;
  const out = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    out[i] = rgba[o]! / 255;
    out[pixels + i] = rgba[o + 1]! / 255;
    out[2 * pixels + i] = rgba[o + 2]! / 255;
  }
  return out;
}

describe('realesrgan tensor converters', () => {
  it('rgbPlanarToRgba / padded / rgbaToPlanarRgb match scalar refs over fuzz', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let t = 0; t < 60; t += 1) {
      const width = 1 + Math.floor(rand() * 37);
      const height = 1 + Math.floor(rand() * 23);
      const pixels = width * height;
      const planar = new Float32Array(3 * pixels);
      for (let i = 0; i < planar.length; i += 1) {
        const v = rand();
        // Sprinkle out-of-range, NaN and exactly 0/1 values.
        planar[i] = t % 5 === 0 && i % 7 === 0 ? (v < 0.5 ? -0.3 : 1.4) : (i % 13 === 0 ? 0 : i % 17 === 0 ? 1 : v);
      }
      const rgba = new Uint8Array(4 * pixels);
      for (let i = 0; i < rgba.length; i += 1) rgba[i] = (i * 53 + t) & 0xff;

      expect(Array.from(rgbPlanarToRgba(planar, width, height))).toEqual(Array.from(refRgbToRgba(planar, width, height)));

      const tight = new Uint8Array(4 * pixels);
      expect(Array.from(rgbPlanarToPaddedRgba(planar, width, height, width * 4, tight))).toEqual(Array.from(refRgbToRgba(planar, width, height)));

      const { bytesPerRow } = planUpload(width, height);
      const padded = rgbPlanarToPaddedRgba(planar, width, height, bytesPerRow);
      const refTight = refRgbToRgba(planar, width, height);
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
          for (let c = 0; c < 4; c += 1) {
            expect(padded[row * bytesPerRow + col * 4 + c]).toBe(refTight[row * width * 4 + col * 4 + c]);
          }
        }
      }

      const planarOut = rgbaToPlanarRgb(rgba, width, height);
      expect(Array.from(planarOut.data)).toEqual(Array.from(refRgbaToPlanar(rgba, width, height)));
    }
  });

  it('non-4-aligned subarray falls back to the byte lane', () => {
    const width = 5;
    const height = 4;
    const pixels = width * height;
    const planar = new Float32Array(3 * pixels);
    for (let i = 0; i < planar.length; i += 1) planar[i] = (i % 256) / 255;
    const backing = new Uint8Array(4 * pixels + 1);
    const view = backing.subarray(1); // byteOffset 1: not 4-aligned
    rgbPlanarToPaddedRgba(planar, width, height, width * 4, view);
    const ref = refRgbToRgba(planar, width, height);
    expect(Array.from(view)).toEqual(Array.from(ref));
  });
});

describe('composeTileResults single-tile fast lane', () => {
  it('returns the tile data itself when it covers the whole output', () => {
    const width = 6;
    const height = 4;
    const rgb = new Float32Array(3 * width * 4 * height * 4);
    for (let i = 0; i < rgb.length; i += 1) rgb[i] = (i % 251) / 251;
    const tiled: TiledInferenceResult = {
      tiles: [{ x: 0, y: 0, width, height, rgb }],
      featherWindow: 48,
      outWidth: width * 4,
      outHeight: height * 4,
    };
    const composed = composeTileResults(tiled);
    expect(composed.rgb).toBe(rgb);
    expect(composed.width).toBe(width * 4);
    expect(composed.height).toBe(height * 4);
    expect(isSingleFullCoverTile(tiled)).toBe(true);
    expect(isSingleFullCoverTile({ ...tiled, tiles: [...tiled.tiles, ...tiled.tiles] })).toBe(false);
  });

  it('stays within 1/255 of the full feathered accumulation', () => {
    // Reproduce the full lane's arithmetic as the reference: single tile, so
    // acc = rgb*weight and weights = weight; the fast lane returns rgb raw.
    const width = 9;
    const height = 7;
    const upW = width * 4;
    const upH = height * 4;
    const pixels = upW * upH;
    const rgb = new Float32Array(3 * pixels);
    let seed = 7;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < rgb.length; i += 1) rgb[i] = rand();
    const full = new Float32Array(3 * pixels);
    const weights = new Float32Array(pixels);
    const fx = featherRamp(upW, 48);
    const fy = featherRamp(upH, 48);
    for (let row = 0; row < upH; row += 1) {
      for (let col = 0; col < upW; col += 1) {
        const w = Math.min(fx[col]!, fy[row]!);
        const i = row * upW + col;
        full[i] = rgb[i]! * w;
        full[pixels + i] = rgb[pixels + i]! * w;
        full[2 * pixels + i] = rgb[2 * pixels + i]! * w;
        weights[i] = w;
      }
    }
    for (let i = 0; i < pixels; i += 1) {
      const w = weights[i]! || 1;
      full[i] = full[i]! / w;
      full[pixels + i] = full[pixels + i]! / w;
      full[2 * pixels + i] = full[2 * pixels + i]! / w;
    }
    const tiled: TiledInferenceResult = {
      tiles: [{ x: 0, y: 0, width, height, rgb }],
      featherWindow: 48,
      outWidth: upW,
      outHeight: upH,
    };
    const fast = composeTileResults(tiled).rgb;
    const fastBytes = rgbPlanarToRgba(fast, upW, upH);
    const fullBytes = rgbPlanarToRgba(full, upW, upH);
    let maxDiff = 0;
    for (let i = 0; i < fastBytes.length; i += 1) {
      maxDiff = Math.max(maxDiff, Math.abs((fastBytes[i] ?? 0) - (fullBytes[i] ?? 0)));
    }
    expect(maxDiff).toBeLessThanOrEqual(1);
  });
});
