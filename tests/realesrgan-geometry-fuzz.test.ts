/**
 * Differential fuzz over the pure RealESRGAN geometry modules: tile plans
 * must cover every pixel with in-bounds uniform tiles, and a detected
 * letterbox rect must verify-hold on the frame it came from. Deterministic
 * PRNG (mulberry32, fixed seed) — no flakiness by construction.
 */
import { describe, expect, it } from 'vitest';
import {
  adaptiveRealEsrganTiling,
  planRealEsrganTiles,
} from '../src/shared/realesrgan-tile-geometry.js';
import {
  detectContentRectRgba,
  fullContentRect,
  verifyCropHoldsRgba,
  LETTERBOX_BYTE_THRESHOLD,
} from '../src/shared/realesrgan-letterbox';
import { hashFrameBytes } from '../src/shared/realesrgan-stillframe';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('tile plan coverage fuzz', () => {
  it('covers every pixel with in-bounds uniform tiles', () => {
    const rand = mulberry32(0xC0FFEE);
    // Small frames: full per-pixel union check stays fast.
    for (let iter = 0; iter < 60; iter += 1) {
      const width = 1 + Math.floor(rand() * 160);
      const height = 1 + Math.floor(rand() * 160);
      const geometry = adaptiveRealEsrganTiling(width, height, {});
      const plan = planRealEsrganTiles(width, height, geometry);
      expect(plan.tiles.length).toBeGreaterThan(0);
      const first = plan.tiles[0]!;
      const covered = new Uint8Array(width * height);
      for (const tile of plan.tiles) {
        // In bounds, positive, uniform with the first tile.
        expect(tile.width).toBe(first.width);
        expect(tile.height).toBe(first.height);
        expect(tile.width).toBeGreaterThan(0);
        expect(tile.height).toBeGreaterThan(0);
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.x + tile.width).toBeLessThanOrEqual(width);
        expect(tile.y + tile.height).toBeLessThanOrEqual(height);
        for (let y = tile.y; y < tile.y + tile.height; y += 1) {
          for (let x = tile.x; x < tile.x + tile.width; x += 1) {
            covered[y * width + x] = 1;
          }
        }
      }
      for (let i = 0; i < covered.length; i += 1) {
        expect(covered[i]).toBe(1);
      }
    }
  });

  it('keeps large frames tiled and bounded', () => {
    const rand = mulberry32(0xB16B00B5);
    for (let iter = 0; iter < 50; iter += 1) {
      const width = 601 + Math.floor(rand() * 3495);
      const height = 601 + Math.floor(rand() * 3495);
      const geometry = adaptiveRealEsrganTiling(width, height, {});
      const plan = planRealEsrganTiles(width, height, geometry);
      for (const tile of plan.tiles) {
        expect(tile.width).toBeLessThanOrEqual(geometry.maxTileSize);
        expect(tile.height).toBeLessThanOrEqual(geometry.maxTileSize);
        expect(tile.x + tile.width).toBeLessThanOrEqual(width);
        expect(tile.y + tile.height).toBeLessThanOrEqual(height);
      }
    }
  });
});

describe('letterbox detect/verify fuzz', () => {
  it('detects exact bars and verifies on the same frame', () => {
    const rand = mulberry32(0xDECAFBAD);
    for (let iter = 0; iter < 60; iter += 1) {
      const width = 16 + Math.floor(rand() * 240);
      const height = 16 + Math.floor(rand() * 240);
      const top = Math.floor(rand() * (height / 4));
      const bottom = Math.floor(rand() * (height / 4));
      const left = Math.floor(rand() * (width / 4));
      const right = Math.floor(rand() * (width / 4));
      const data = new Uint8Array(width * height * 4);
      // Content strictly above the black threshold: detection is exact.
      for (let i = 0; i < data.length; i += 1) {
        data[i] = LETTERBOX_BYTE_THRESHOLD + 1 + Math.floor(rand() * (255 - LETTERBOX_BYTE_THRESHOLD));
      }
      for (let i = 3; i < data.length; i += 4) data[i] = 255;
      // Paint the bars black.
      for (let y = 0; y < top; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const o = (y * width + x) * 4;
          data[o] = 0; data[o + 1] = 0; data[o + 2] = 0;
        }
      }
      for (let y = height - bottom; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const o = (y * width + x) * 4;
          data[o] = 0; data[o + 1] = 0; data[o + 2] = 0;
        }
      }
      for (let y = top; y < height - bottom; y += 1) {
        for (let x = 0; x < left; x += 1) {
          const o = (y * width + x) * 4;
          data[o] = 0; data[o + 1] = 0; data[o + 2] = 0;
        }
        for (let x = width - right; x < width; x += 1) {
          const o = (y * width + x) * 4;
          data[o] = 0; data[o + 1] = 0; data[o + 2] = 0;
        }
      }
      const expected = (top + bottom >= height || left + right >= width)
        ? fullContentRect(width, height)
        : { x: left, y: top, width: width - left - right, height: height - top - bottom };
      const detected = detectContentRectRgba(data, width, height);
      expect(detected).toEqual(expected);
      // The adopted rect must verify-hold on the frame it came from.
      expect(verifyCropHoldsRgba(data, width, height, detected)).toBe(true);
    }
  });

  it('keeps fully black frames whole', () => {
    const data = new Uint8Array(64 * 64 * 4);
    expect(detectContentRectRgba(data, 64, 64)).toEqual(fullContentRect(64, 64));
  });
});

describe('stillframe hash fuzz', () => {
  it('is deterministic and length-sensitive', () => {
    const rand = mulberry32(1234);
    for (let iter = 0; iter < 50; iter += 1) {
      const len = 64 + Math.floor(rand() * 4096);
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) bytes[i] = Math.floor(rand() * 256);
      expect(hashFrameBytes(bytes)).toBe(hashFrameBytes(bytes.slice()));
      // Same prefix but different length hashes differently (length mixed in).
      if (len > 64) {
        expect(hashFrameBytes(bytes)).not.toBe(hashFrameBytes(bytes.slice(0, len - 1)));
      }
    }
  });
});
