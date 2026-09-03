import './setup-worker-stub';
import { bench, describe } from 'vitest';
import {
  composeTileResults,
  featherRamp,
  type InferredTile,
  type TiledInferenceResult,
} from '../src/shared/realesrgan-tensor';
import { composeTilesToRgba8, stackTilesToBatch, splitBatchedOutput } from '../src/worker/realesrgan-inference-worker.js';
import { buildComposeBuffers } from '../src/core/realesrgan-compose';
import { planReadback, unpackReadback, unpackReadbackToPlanarRgb, decodeFloat16 } from '../src/shared/realesrgan-readback';
import { RealEsrganBufferPool } from '../src/shared/realesrgan-buffer-pool';

// Helpers to build deterministic tile fixtures without per-iteration allocation
function makeTileRgb(tileW: number, tileH: number, seed: number): Float32Array {
  const upW = tileW * 4;
  const upH = tileH * 4;
  const a = new Float32Array(3 * upW * upH);
  for (let i = 0; i < a.length; i++) a[i] = ((i * 17 + seed) % 256) / 255;
  return a;
}

function makePlanarInput(w: number, h: number): Float32Array {
  const p = new Float32Array(3 * w * h);
  for (let i = 0; i < p.length; i++) p[i] = (i % 256) / 255;
  return p;
}

// Small composed fixtures: 64x64 source tiles -> 256x256 upscaled tiles
// Keeps compose bench fast (~65k pixels per tile) while exercising feathering.
function buildTiledResult(tileCount: number, tileW: number, tileH: number): TiledInferenceResult {
  const cols = Math.ceil(Math.sqrt(tileCount));
  const rows = Math.ceil(tileCount / cols);
  const srcW = cols * tileW;
  const srcH = rows * tileH;
  const tiles: InferredTile[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (idx >= tileCount) break;
      tiles.push({
        x: c * tileW,
        y: r * tileH,
        width: tileW,
        height: tileH,
        rgb: makeTileRgb(tileW, tileH, idx * 101),
      });
      idx++;
    }
  }
  const featherWindow = 48; // 24 * 2 typical
  return { tiles, featherWindow, outWidth: srcW * 4, outHeight: srcH * 4 };
}

function buildWorkerTiles(tileCount: number, tileW: number, tileH: number) {
  const r = buildTiledResult(tileCount, tileW, tileH);
  return r.tiles.map(t => ({ x: t.x, y: t.y, width: t.width, height: t.height, rgb: t.rgb }));
}

// Prebuilt tiled results (reused; compose allocates internally)
const tiled1 = buildTiledResult(1, 64, 64);
const tiled4 = buildTiledResult(4, 64, 64);
const tiled9 = buildTiledResult(9, 64, 64);
const workerTiles1 = buildWorkerTiles(1, 64, 64);
const workerTiles4 = buildWorkerTiles(4, 64, 64);
const workerTiles9 = buildWorkerTiles(9, 64, 64);

// Medium: 2 tiles of 256x256 -> out 1024x512 (524k pixels) — heavier but still benchable
const tiled2x256 = buildTiledResult(2, 256, 256);

// StackTiles fixtures
const planar720 = makePlanarInput(1280, 720);
const tiles720_512 = (() => {
  // 1280x720 with 512 tiles has ~6 tiles (2 cols x 3 rows)
  const tiles = [];
  const overlap = 24;
  const maxTile = 512;
  const xs = [0, 512 - overlap, 1280 - 512]; // 0, 488, 768
  const ys = [0, 512 - overlap, 720 - 512]; // 0, 488, 208
  // dedup
  const uniqXs = [...new Set(xs)].filter(x => x >= 0 && x + maxTile <= 1280);
  const uniqYs = [...new Set(ys)].filter(y => y >= 0 && y + maxTile <= 720);
  for (const y of uniqYs) for (const x of uniqXs) tiles.push({ x, y, width: 512, height: 512 });
  // also single full frame case for comparison
  return tiles;
})();

// Readback fixtures
const readback640Plan = planReadback(640, 360, 'rgba8unorm');
const padded640 = new Uint8Array(readback640Plan.byteLength);
for (let i = 0; i < padded640.length; i++) padded640[i] = (i * 31) & 0xff;

// Pooled buffers — bench the hot reload path
const pool = new RealEsrganBufferPool(2);

describe('stackTilesToBatch', () => {
  bench('1280x720 6 tiles 512x512', () => {
    stackTilesToBatch(planar720, 1280, 720, tiles720_512);
  });
  bench('640x360 1 tile 640x360 (single batch)', () => {
    const p = makePlanarInput(640, 360);
    stackTilesToBatch(p, 640, 360, [{ x: 0, y: 0, width: 640, height: 360 }]);
  });
});

describe('splitBatchedOutput', () => {
  const batched = new Float32Array(6 * 3 * 512 * 4 * 512 * 4);
  bench('split 6 tiles 512', () => {
    splitBatchedOutput(batched, tiles720_512);
  });
});

describe('buildComposeBuffers (GPU compose prep)', () => {
  bench('1 tile 64x64 -> 256x256', () => {
    buildComposeBuffers(workerTiles1, 48);
  });
  bench('4 tiles 64x64', () => {
    buildComposeBuffers(workerTiles4, 48);
  });
  bench('9 tiles 64x64', () => {
    buildComposeBuffers(workerTiles9, 48);
  });
});

describe('composeTileResults (CPU feather, shared)', () => {
  bench('1 tile 64x64 -> 256x256', () => {
    composeTileResults(tiled1);
  });
  bench('4 tiles 64x64 -> 512x512 (262k pixels)', () => {
    composeTileResults(tiled4);
  });
  bench('9 tiles 64x64 -> 768x768 (589k pixels)', () => {
    composeTileResults(tiled9);
  });
  bench('4 tiles with pooled buffers 64x64', () => {
    const outPixels = tiled4.outWidth * tiled4.outHeight;
    const acc = new Float32Array(3 * outPixels);
    const w = new Float32Array(outPixels);
    composeTileResults(tiled4, acc, w);
  });
  bench('2 tiles 256x256 -> 1024x512 (heavier)', () => {
    composeTileResults(tiled2x256);
  });
});

describe('composeTilesToRgba8 (worker CPU path)', () => {
  bench('1 tile 64x64', () => {
    composeTilesToRgba8(workerTiles1, tiled1.outWidth, tiled1.outHeight, 48);
  });
  bench('4 tiles 64x64', () => {
    composeTilesToRgba8(workerTiles4, tiled4.outWidth, tiled4.outHeight, 48);
  });
  bench('9 tiles 64x64', () => {
    composeTilesToRgba8(workerTiles9, tiled9.outWidth, tiled9.outHeight, 48);
  });
});

describe('readback — plan / unpack', () => {
  bench('planReadback 640x360 rgba8', () => {
    planReadback(640, 360, 'rgba8unorm');
  });
  bench('planReadback 1920x1080 rgba16float', () => {
    planReadback(1920, 1080, 'rgba16float');
  });
  bench('unpackReadback 640x360 rgba8', () => {
    unpackReadback(padded640, 640, 360, 'rgba8unorm');
  });
  bench('unpackReadbackToPlanarRgb 640x360 fused', () => {
    unpackReadbackToPlanarRgb(padded640, 640, 360, 'rgba8unorm');
  });
  bench('two-step unpack + rgbaToPlanar (baseline) 640x360', async () => {
    const { rgbaToPlanarRgb } = await import('../src/shared/realesrgan-tensor');
    const tight = unpackReadback(padded640, 640, 360, 'rgba8unorm');
    rgbaToPlanarRgb(tight, 640, 360);
  });
});

describe('decodeFloat16', () => {
  bench('decode 1024 random f16 values', () => {
    let s = 0;
    for (let i = 0; i < 1024; i++) s += decodeFloat16((i * 12345) & 0xffff);
    if (s === 123456) throw new Error('dead');
  });
});

describe('featherRamp (reused in compose inner loop)', () => {
  bench('2048 window 48', () => { void featherRamp(2048, 48); });
  bench('1024 window 48', () => { void featherRamp(1024, 48); });
});

describe('RealEsrganBufferPool', () => {
  bench('acquire/release 1MB hit', () => {
    const b = pool.acquire(1024 * 1024);
    pool.release(b);
  });
  bench('acquire 1MB miss (new ArrayBuffer)', () => {
    const p = new RealEsrganBufferPool(0);
    p.acquire(1024 * 1024);
  });
  bench('acquire/release 100MB accumulator (1080p 4x)', () => {
    const bytes = 3 * 7680 * 4320 * 4; // 1080p 4x float32 accumulator
    const b = pool.acquire(bytes);
    pool.release(b);
  });
});
