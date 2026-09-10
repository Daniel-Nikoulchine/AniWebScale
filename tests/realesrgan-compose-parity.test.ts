/**
 * Cross-engine compose parity: the main-thread tensor composer and the
 * worker's RGBA8 composer must produce byte-identical frames for synthetic
 * input. Both share the same separable feathering math, but they are separate
 * implementations, so this test is the seam that catches drift.
 */
import { describe, expect, it, vi } from 'vitest';

// The worker assigns `self.onmessage` at module scope, so a `self` stub must
// exist BEFORE the import (same pattern as the other worker suites).
vi.hoisted(() => {
  (globalThis as { self?: unknown }).self = { postMessage: () => {} };
});
import {
  composeSingleTileToRgba8,
  composeTilesToRgba8,
  downscaleRgba8Box,
} from '../src/worker/realesrgan-inference-worker.js';
import {
  composeTileResults,
  rgbPlanarToRgba,
  type InferredTile,
  type TiledInferenceResult,
} from '../src/shared/realesrgan-tensor';

function planarTile(width: number, height: number, seed: number): Float32Array {
  const pixels = width * height;
  const data = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    data[i] = ((i * 37 + seed * 11) % 256) / 255;
    data[pixels + i] = ((i * 53 + seed * 7) % 256) / 255;
    data[2 * pixels + i] = ((i * 97 + seed * 3) % 256) / 255;
  }
  // Boundary values exercise the shared clamp/round path identically.
  data[0] = -0.25;
  data[pixels] = 1.25;
  data[2 * pixels] = 0;
  return data;
}

describe('compose parity (tensor vs worker)', () => {
  it('multi-tile feathered compose is byte-identical', () => {
    const tiles: InferredTile[] = [
      { x: 0, y: 0, width: 2, height: 2, rgb: planarTile(2, 2, 1) },
      { x: 1, y: 0, width: 2, height: 2, rgb: planarTile(2, 2, 2) },
    ];
    const tiled: TiledInferenceResult = { tiles, featherWindow: 4, outWidth: 3 * 4, outHeight: 2 * 4 };
    const tensor = composeTileResults(tiled);
    const tensorBytes = rgbPlanarToRgba(tensor.rgb, tensor.width, tensor.height);
    const workerBytes = composeTilesToRgba8(tiles, tiled.outWidth, tiled.outHeight, tiled.featherWindow);
    expect(Array.from(workerBytes)).toEqual(Array.from(tensorBytes));
  });

  it('single full-cover tile is byte-identical', () => {
    const rgb = planarTile(8, 8, 9);
    const tensor = composeTileResults({
      tiles: [{ x: 0, y: 0, width: 2, height: 2, rgb }],
      featherWindow: 4,
      outWidth: 8,
      outHeight: 8,
    });
    const tensorBytes = rgbPlanarToRgba(tensor.rgb, tensor.width, tensor.height);
    const workerBytes = composeSingleTileToRgba8(rgb, 8, 8);
    expect(Array.from(workerBytes)).toEqual(Array.from(tensorBytes));
  });

  it('worker box downscale matches an independent scalar box average', () => {
    const srcW = 4;
    const srcH = 4;
    const src = new Uint8Array(srcW * srcH * 4);
    for (let i = 0; i < srcW * srcH; i += 1) {
      src[i * 4] = (i * 13) % 256;
      src[i * 4 + 1] = (i * 29) % 256;
      src[i * 4 + 2] = (i * 71) % 256;
      src[i * 4 + 3] = 255;
    }
    const dstW = 2;
    const dstH = 2;
    const worker = downscaleRgba8Box(src, srcW, srcH, dstW, dstH);
    const reference = new Uint8Array(dstW * dstH * 4);
    for (let dy = 0; dy < dstH; dy += 1) {
      for (let dx = 0; dx < dstW; dx += 1) {
        for (let c = 0; c < 3; c += 1) {
          let sum = 0;
          for (let sy = 0; sy < 2; sy += 1) {
            for (let sx = 0; sx < 2; sx += 1) {
              sum += src[(((dy * 2 + sy) * srcW) + dx * 2 + sx) * 4 + c];
            }
          }
          reference[(dy * dstW + dx) * 4 + c] = Math.round(sum / 4);
        }
        reference[(dy * dstW + dx) * 4 + 3] = 255;
      }
    }
    expect(Array.from(worker)).toEqual(Array.from(reference));
  });
});
