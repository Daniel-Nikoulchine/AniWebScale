/**
 * Tile geometry agreement: the canonical module, the content planner and
 * the generated worker copy must produce identical tile sets. Any drift
 * paints wrong pixels silently, so this matrix gates it loudly.
 */
import { describe, expect, it, vi } from 'vitest';
// The worker assigns `self.onmessage` at module scope, so a `self` stub must
// exist BEFORE the import (same pattern as realesrgan-worker-frame.test.ts).
vi.hoisted(() => {
  (globalThis as { self?: unknown }).self = { postMessage: () => {} };
});
import {
  adaptiveRealEsrganTiling,
  defaultOverlapFor,
  defaultSingleTileMaxHeight,
  featherWindowForOverlap,
  planRealEsrganTiles,
  planUniformTiles as planCanonicalTiles,
  planWorkerFrame,
} from '../src/shared/realesrgan-tile-geometry.js';
import {
  planUniformTiles as planWorkerTiles,
  singleTileMaxHeightForFrame,
} from '../src/worker/realesrgan-inference-worker.js';

const GEOMETRIES: Array<[number, number]> = [
  [640, 360],
  [853, 480],
  [960, 540],
  [1280, 720],
  [1920, 1080],
  [640, 900],
  [3840, 2160],
];

describe('canonical geometry agreement', () => {
  for (const [w, h] of GEOMETRIES) {
    it(`content plan matches worker plan at ${w}x${h}`, () => {
      const opts = adaptiveRealEsrganTiling(w, h);
      const content = planRealEsrganTiles(w, h, opts);
      const worker = planWorkerTiles(w, h, opts.maxTileSize, opts.overlap, opts.singleTileMaxHeight);
      expect(worker).toEqual(content.tiles);
    });
  }

  for (const [w, h] of GEOMETRIES) {
    it(`gate matches at ${w}x${h}`, () => {
      for (const maxTile of [384, 512]) {
        expect(singleTileMaxHeightForFrame(w, h, maxTile)).toBe(
          defaultSingleTileMaxHeight(w, h, maxTile),
        );
      }
    });
  }

  it('worker frame geometry matches the adaptive policy', () => {
    for (const [w, h] of GEOMETRIES) {
      const frame = planWorkerFrame(w, h);
      const opts = adaptiveRealEsrganTiling(w, h);
      expect(frame.maxTileSize).toBe(opts.maxTileSize);
      expect(frame.overlap).toBe(opts.overlap);
      expect(frame.singleTileMaxHeight).toBe(opts.singleTileMaxHeight);
      expect(frame.tiles).toEqual(planRealEsrganTiles(w, h, opts).tiles);
      expect(frame.featherWindow).toBe(featherWindowForOverlap(opts.overlap));
    }
  });

  it('feather rule holds: overlap 24 always yields window 48', () => {
    expect(defaultOverlapFor(512)).toBe(24);
    expect(defaultOverlapFor(384)).toBe(24);
    expect(featherWindowForOverlap(24)).toBe(48);
  });

  it('canonical planner rejects invalid input like the content wrapper', () => {
    expect(() => planCanonicalTiles(0, 480, 512, 24, 576)).toThrow(/width/);
    expect(() => planCanonicalTiles(640, 480, 512, 512, 576)).toThrow(/overlap/);
    expect(() => planRealEsrganTiles(640, 480, {
      maxTileSize: 512, overlap: 24, singleTileMaxHeight: 0,
    })).toThrow(/singleTileMaxHeight/);
  });
});
