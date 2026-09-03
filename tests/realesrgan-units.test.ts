import { describe, expect, it } from 'vitest';
import { RealEsrganBufferPool } from '../src/shared/realesrgan-buffer-pool';
import { adaptiveRealEsrganTiling, planRealEsrganTiles } from '../src/shared/realesrgan-tiling';
import { planReadback, decodeFloat16, unpackReadback } from '../src/shared/realesrgan-readback';
import { RealEsrganFrameScheduler } from '../src/shared/realesrgan-pacing';
import { RealEsrganFrameJobRunner } from '../src/core/realesrgan-frame-job';
import { buildComposeBuffers } from '../src/core/realesrgan-compose';
import { DEFAULT_REALESRGAN_TILING } from '../src/core/realesrgan-pipeline';

describe('RealEsrganBufferPool', () => {
  it('reuses a released buffer of the same size', () => {
    const pool = new RealEsrganBufferPool(2);
    const a = pool.acquire(1024);
    pool.release(a);
    const b = pool.acquire(1024);
    expect(b).toBe(a);
    expect(pool.pooledCount).toBe(0);
  });

  it('caps pooled buffers per size', () => {
    const pool = new RealEsrganBufferPool(2);
    const bufs = [new ArrayBuffer(64), new ArrayBuffer(64), new ArrayBuffer(64)];
    for (const b of bufs) pool.release(b);
    expect(pool.pooledCount).toBe(2);
    // Different size is tracked separately
    pool.release(new ArrayBuffer(128));
    expect(pool.pooledCount).toBe(3);
  });

  it('clear() drops all pooled buffers', () => {
    const pool = new RealEsrganBufferPool();
    pool.release(new ArrayBuffer(32));
    pool.release(new ArrayBuffer(32));
    expect(pool.pooledCount).toBeGreaterThan(0);
    pool.clear();
    expect(pool.pooledCount).toBe(0);
  });

  it('acquires fresh buffer when pool misses', () => {
    const pool = new RealEsrganBufferPool();
    const a = pool.acquire(100);
    const b = pool.acquire(200);
    expect(a.byteLength).toBe(100);
    expect(b.byteLength).toBe(200);
    expect(a).not.toBe(b);
  });
});

describe('adaptiveRealEsrganTiling', () => {
  it('picks 512 for small frames and 384 for >=1080p', () => {
    expect(adaptiveRealEsrganTiling(640, 480).maxTileSize).toBe(512);
    expect(adaptiveRealEsrganTiling(1920, 1080).maxTileSize).toBe(384);
    expect(adaptiveRealEsrganTiling(3840, 2160).maxTileSize).toBe(384);
  });

  it('always uses 24px overlap for both geometries', () => {
    expect(adaptiveRealEsrganTiling(640, 480).overlap).toBe(24);
    expect(adaptiveRealEsrganTiling(1920, 1080).overlap).toBe(24);
  });

  it('keeps the pipeline default identical to the adaptive small-frame geometry', () => {
    // The worker mirrors adaptiveRealEsrganTiling() with empty options; the
    // pipeline default must match it so both paths place tiles and feather
    // identically (overlap 24 / feather 48, single-tile up to 512px height).
    expect(DEFAULT_REALESRGAN_TILING).toEqual(adaptiveRealEsrganTiling(640, 480));
  });

  it('caps singleTileMaxHeight at maxTileSize', () => {
    const tiling = adaptiveRealEsrganTiling(1920, 1080);
    expect(tiling.singleTileMaxHeight).toBe(384);
    expect(tiling.singleTileMaxHeight).toBeLessThanOrEqual(tiling.maxTileSize);
  });

  it('respects explicit overrides', () => {
    const t = adaptiveRealEsrganTiling(800, 600, { maxTileSize: 256, overlap: 16, singleTileMaxHeight: 200 });
    expect(t.maxTileSize).toBe(256);
    expect(t.overlap).toBe(16);
    expect(t.singleTileMaxHeight).toBe(200);
  });
});

describe('planRealEsrganTiles', () => {
  it('returns single tile for short sources', () => {
    const plan = planRealEsrganTiles(640, 480, { maxTileSize: 512, overlap: 24, singleTileMaxHeight: 576 });
    expect(plan.tiles).toHaveLength(1);
    expect(plan.tiles[0]).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it('tiles tall sources with overlap', () => {
    const plan = planRealEsrganTiles(640, 900, { maxTileSize: 512, overlap: 24, singleTileMaxHeight: 576 });
    expect(plan.tiles.length).toBeGreaterThan(1);
    for (const tile of plan.tiles) {
      expect(tile.width).toBeLessThanOrEqual(512);
      expect(tile.height).toBeLessThanOrEqual(512);
    }
    // Last row should touch bottom
    const maxY = Math.max(...plan.tiles.map(t => t.y));
    const maxYTile = plan.tiles.find(t => t.y === maxY)!;
    expect(maxYTile.y + maxYTile.height).toBe(900);
  });

  it('validates inputs', () => {
    expect(() => planRealEsrganTiles(0, 480, { maxTileSize: 512, overlap: 24, singleTileMaxHeight: 576 })).toThrow();
    expect(() => planRealEsrganTiles(640, 480, { maxTileSize: 0, overlap: 24, singleTileMaxHeight: 576 })).toThrow();
    expect(() => planRealEsrganTiles(640, 480, { maxTileSize: 512, overlap: 512, singleTileMaxHeight: 576 })).toThrow();
  });
});

describe('planReadback / decodeFloat16 / unpackReadback', () => {
  it('aligns bytesPerRow to 256', () => {
    const plan = planReadback(640, 480, 'rgba8unorm');
    expect(plan.bytesPerRow % 256).toBe(0);
    expect(plan.byteLength).toBe(plan.bytesPerRow * 480);
    // Tight 640*4=2560 -> already 256 aligned -> stays 2560
    expect(plan.bytesPerRow).toBe(2560);
    const plan2 = planReadback(641, 480, 'rgba8unorm');
    expect(plan2.bytesPerRow).toBe(2816); // next multiple of 256 after 2564
  });

  it('decodes f16 special values', () => {
    // 1.0 in f16 is 0x3c00
    expect(decodeFloat16(0x3c00)).toBeCloseTo(1.0, 5);
    // 0.5 is 0x3800
    expect(decodeFloat16(0x3800)).toBeCloseTo(0.5, 5);
    // +inf
    expect(decodeFloat16(0x7c00)).toBe(Infinity);
    // NaN
    expect(Number.isNaN(decodeFloat16(0x7e00))).toBe(true);
    // subnormal
    expect(decodeFloat16(0x0001)).toBeGreaterThan(0);
  });

  it('strips padding for rgba8unorm', () => {
    const width = 2, height = 2;
    const plan = planReadback(width, height, 'rgba8unorm');
    // bytesPerRow = 256, each row has 8 tight bytes + 248 padding
    const padded = new Uint8Array(plan.byteLength).fill(0xcc);
    // Fill tight pixels with known pattern
    const pixels = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]);
    for (let row = 0; row < height; row += 1) {
      padded.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), row * plan.bytesPerRow);
    }
    const unpacked = unpackReadback(padded, width, height, 'rgba8unorm');
    expect(unpacked).toEqual(pixels);
  });
});

describe('RealEsrganFrameScheduler', () => {
  it('shouldProcess only when idle and newer than seen', () => {
    const s = new RealEsrganFrameScheduler();
    expect(s.shouldProcess(1)).toBe(true);
    s.markStarted(1);
    expect(s.shouldProcess(2)).toBe(false); // in flight
    s.markCompleted(1);
    expect(s.shouldProcess(2)).toBe(true);
    expect(s.shouldProcess(1)).toBe(false); // not newer
  });

  it('counts skipped frames while in flight', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.noteNewerFrame(2);
    s.noteNewerFrame(3);
    s.noteNewerFrame(4);
    expect(s.skippedFrames).toBe(3);
    // Unrelated older frame does not increment
    s.noteNewerFrame(2);
    expect(s.skippedFrames).toBe(3);
  });

  it('isResultCurrent drops stale results', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.noteNewerFrame(2);
    expect(s.isResultCurrent(1)).toBe(false);
    expect(s.droppedResults).toBe(1);
    expect(s.isResultCurrent(2)).toBe(true);
  });

  it('reset clears state', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.noteNewerFrame(2);
    s.reset();
    expect(s.shouldProcess(1)).toBe(true);
    expect(s.skippedFrames).toBe(0);
  });
});

describe('RealEsrganFrameJobRunner', () => {
  it('serializes to latest-frame-wins', async () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner(scheduler);
    const published: number[] = [];
    // Start job 1 (slow)
    const slowInfer = () => new Promise<string>(resolve => setTimeout(() => resolve('1'), 30));
    runner.submit({ frame: 1, capture: async () => 'c1', infer: slowInfer, publish: () => published.push(1) });
    // Submit newer frames while busy: they should be skipped, not run
    expect(runner.submit({ frame: 2, capture: async () => 'c2', infer: async () => '2', publish: () => published.push(2) })).toBe(false);
    expect(runner.submit({ frame: 3, capture: async () => 'c3', infer: async () => '3', publish: () => published.push(3) })).toBe(false);
    // Wait for first to finish: its result is stale because 3 is newer, so it should be dropped (latest wins)
    await new Promise(r => setTimeout(r, 50));
    expect(published).toEqual([]);
    expect(scheduler.skippedFrames).toBe(2);
    expect(scheduler.droppedResults).toBe(1);
    // Now next frame should run and publish because it is the newest
    expect(runner.submit({ frame: 4, capture: async () => 'c4', infer: async () => '4', publish: () => published.push(4) })).toBe(true);
    await new Promise(r => setTimeout(r, 10));
    expect(published).toEqual([4]);
  });
});

describe('buildComposeBuffers', () => {
  it('packs a single tile', () => {
    const rgb = new Float32Array(3 * 4 * 4).fill(0.5);
    const { descs, data } = buildComposeBuffers([{ x: 0, y: 0, width: 1, height: 1, rgb }], 4);
    expect(descs.length).toBe(8);
    expect(descs[0]).toBe(0); expect(descs[1]).toBe(0);
    expect(descs[2]).toBe(4); expect(descs[3]).toBe(4);
    expect(descs[5]).toBe(4);
    expect(data.length).toBe(48);
  });

  it('validates tile rgb length', () => {
    const bad = new Float32Array(10);
    expect(() => buildComposeBuffers([{ x: 0, y: 0, width: 1, height: 1, rgb: bad }], 4)).toThrow();
  });
});
