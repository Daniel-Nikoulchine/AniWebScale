import { describe, expect, it, vi } from 'vitest';
import { RealEsrganBufferPool } from '../src/shared/realesrgan-buffer-pool';
import { adaptiveRealEsrganTiling, defaultSingleTileMaxHeight, planRealEsrganTiles } from '../src/shared/realesrgan-tile-geometry.js';
import { planReadback, decodeFloat16, unpackReadback, copyMappedRange } from '../src/shared/realesrgan-readback';
import { RealEsrganFrameScheduler } from '../src/shared/realesrgan-pacing';
import { RealEsrganFrameJobRunner } from '../src/core/realesrgan-frame-job';
import { buildComposeBuffers } from '../src/core/realesrgan-compose';
import { DEFAULT_REALESRGAN_TILING } from '../src/core/realesrgan-pipeline';
import { RealEsrganSessionFactory } from '../src/core/realesrgan-session';

vi.mock('onnxruntime-web', () => ({
  env: { wasm: {} },
  InferenceSession: {
    create: vi.fn(async (url: string) => ({ createdFrom: url })),
  },
}));

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

  it('keeps the pipeline default on the safe 512 gate (main-thread fallback)', () => {
    // The worker takes Hebel 1.2's bounded 576 gate; the pipeline default
    // feeds the MAIN-THREAD fallback (weakest devices), so tile size and
    // overlap match the adaptive geometry but the single-tile gate stays 512.
    expect(DEFAULT_REALESRGAN_TILING.maxTileSize).toBe(adaptiveRealEsrganTiling(640, 480).maxTileSize);
    expect(DEFAULT_REALESRGAN_TILING.overlap).toBe(adaptiveRealEsrganTiling(640, 480).overlap);
    expect(DEFAULT_REALESRGAN_TILING.singleTileMaxHeight).toBe(512);
  });

  it('caps singleTileMaxHeight at maxTileSize', () => {
    const tiling = adaptiveRealEsrganTiling(1920, 1080);
    expect(tiling.singleTileMaxHeight).toBe(384);
    expect(tiling.singleTileMaxHeight).toBeLessThanOrEqual(tiling.maxTileSize);
  });

  it('Hebel 1.2: bounded 576 gate for small frames, tile-size gate beyond', () => {
    // 960x540 (518k px): single-tile instead of two ~fully-overlapping tiles.
    expect(adaptiveRealEsrganTiling(960, 540).singleTileMaxHeight).toBe(576);
    expect(defaultSingleTileMaxHeight(960, 540, 512)).toBe(576);
    // 1920x540 ultrawide (1M px): keeps tiling, transient budget bounded.
    expect(adaptiveRealEsrganTiling(1920, 540).singleTileMaxHeight).toBe(512);
    expect(defaultSingleTileMaxHeight(1920, 540, 512)).toBe(512);
    // 384 geometry (huge inputs): unchanged.
    expect(defaultSingleTileMaxHeight(1920, 1080, 384)).toBe(384);
    // The promoted frame actually plans single-tile end to end.
    const plan = planRealEsrganTiles(960, 540, adaptiveRealEsrganTiling(960, 540));
    expect(plan.tiles).toEqual([{ x: 0, y: 0, width: 960, height: 540 }]);
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

  it('fills a caller-owned buffer instead of allocating', () => {
    const width = 3, height = 2;
    const plan = planReadback(width, height, 'rgba8unorm');
    const padded = new Uint8Array(plan.byteLength);
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i += 1) pixels[i] = i % 251;
    for (let row = 0; row < height; row += 1) {
      padded.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), row * plan.bytesPerRow);
    }
    const out = new Uint8Array(width * height * 4).fill(0xaa);
    expect(unpackReadback(padded, width, height, 'rgba8unorm', out)).toBe(out);
    expect(out).toEqual(pixels);
  });

  it('rejects a wrongly sized out buffer', () => {
    const padded = new Uint8Array(planReadback(2, 2, 'rgba8unorm').byteLength);
    expect(() => unpackReadback(padded, 2, 2, 'rgba8unorm', new Uint8Array(15))).toThrow();
  });

  it('copyMappedRange copies the fast path byte-identically', () => {
    const range = new ArrayBuffer(64);
    new Uint8Array(range).forEach((_, i, a) => { a[i] = (i * 7) % 251; });
    const out = new Uint8Array(64);
    copyMappedRange(range, out);
    expect(out).toEqual(new Uint8Array(range));
  });

  it('copyMappedRange clones when view construction throws (hostile buffer)', () => {
    const range = new ArrayBuffer(32);
    new Uint8Array(range).forEach((_, i, a) => { a[i] = 255 - i; });
    const out = new Uint8Array(32);
    const hostileViewOf = () => { throw new Error('Permission denied to access property "constructor"'); };
    copyMappedRange(range, out, hostileViewOf);
    expect(out).toEqual(new Uint8Array(range));
  });

  it('copyMappedRange throws when the range is short', () => {
    expect(() => copyMappedRange(new ArrayBuffer(8), new Uint8Array(16))).toThrow();
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

  it('Hebel 2.4: depth 2 admits a second frame while one is in flight', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    expect(s.shouldProcess(2, 1)).toBe(false);
    expect(s.shouldProcess(2, 2)).toBe(true);
    s.markStarted(2);
    expect(s.shouldProcess(3, 2)).toBe(false); // both slots busy
    s.markCompleted(1);
    expect(s.shouldProcess(3, 2)).toBe(true);
  });

  it('counts skipped frames while in flight', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.noteSkipped(2);
    s.noteSkipped(3);
    s.noteSkipped(4);
    expect(s.skippedFrames).toBe(3);
    // Unrelated older frame does not increment
    s.noteSkipped(2);
    expect(s.skippedFrames).toBe(3);
  });

  it('never counts started frames as skipped (depth-2 accounting)', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.markStarted(2);
    expect(s.skippedFrames).toBe(0);
    expect(s.shouldProcess(3, 2)).toBe(false);
  });

  it('isResultCurrent drops stale results', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.noteSkipped(2);
    expect(s.isResultCurrent(1)).toBe(false);
    expect(s.droppedResults).toBe(1);
    expect(s.isResultCurrent(2)).toBe(true);
  });

  it('newestInFlightFrame tracks unfinished work for stale-skip', () => {
    const s = new RealEsrganFrameScheduler();
    expect(s.newestInFlightFrame()).toBe(-1);
    s.markStarted(3);
    s.markStarted(7);
    expect(s.newestInFlightFrame()).toBe(7);
    s.markCompleted(7);
    expect(s.newestInFlightFrame()).toBe(3);
    s.markCompleted(3);
    expect(s.newestInFlightFrame()).toBe(-1);
  });

  it('reset clears state', () => {
    const s = new RealEsrganFrameScheduler();
    s.markStarted(1);
    s.noteSkipped(2);
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

  it('Hebel 2.4: depth 2 overlaps two jobs, newest completion publishes', async () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner(scheduler);
    const published: number[] = [];
    const slowInfer = () => new Promise<string>(resolve => setTimeout(() => resolve('1'), 30));
    const fastInfer = () => new Promise<string>(resolve => setTimeout(() => resolve('2'), 5));
    expect(runner.submit({ frame: 1, capture: async () => 'c1', infer: slowInfer, publish: () => published.push(1) }, 2)).toBe(true);
    expect(runner.submit({ frame: 2, capture: async () => 'c2', infer: fastInfer, publish: () => published.push(2) }, 2)).toBe(true);
    await new Promise(r => setTimeout(r, 50));
    // Frame 2 completed first while newest: published. Frame 1 landed stale: dropped.
    expect(published).toEqual([2]);
    expect(scheduler.skippedFrames).toBe(0);
    expect(scheduler.droppedResults).toBe(1);
  });

  it('Hebel 2.4: rejected submissions poison newness like at depth 1', async () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner(scheduler);
    const published: number[] = [];
    const slowInfer = (tag: string) => () => new Promise<string>(resolve => setTimeout(() => resolve(tag), 30));
    expect(runner.submit({ frame: 1, capture: async () => 'c1', infer: slowInfer('1'), publish: () => published.push(1) }, 2)).toBe(true);
    expect(runner.submit({ frame: 2, capture: async () => 'c2', infer: slowInfer('2'), publish: () => published.push(2) }, 2)).toBe(true);
    // Both slots busy: third frame is skipped, not run — but it still
    // advances newest-seen, so both in-flight results land stale.
    expect(runner.submit({ frame: 3, capture: async () => 'c3', infer: async () => '3', publish: () => published.push(3) }, 2)).toBe(false);
    await new Promise(r => setTimeout(r, 50));
    expect(published).toEqual([]);
    expect(scheduler.skippedFrames).toBe(1);
    expect(scheduler.droppedResults).toBe(2);
  });

  it('claimPresentation is the monotonic watermark for out-of-band presenters', () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner(scheduler);
    // Newest completed presents first; an older latecomer keeps its bytes
    // off the canvas.
    expect(runner.claimPresentation(2)).toBe(true);
    expect(runner.claimPresentation(1)).toBe(false);
    // A newer frame still presents (newest-completed wins, not newest-seen).
    expect(runner.claimPresentation(3)).toBe(true);
    // Same frame twice: the second write must not interleave.
    expect(runner.claimPresentation(3)).toBe(false);
  });

  it('reset clears the presentation watermark', () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner(scheduler);
    expect(runner.claimPresentation(5)).toBe(true);
    runner.reset();
    expect(runner.claimPresentation(5)).toBe(true);
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

describe('RealEsrganSessionFactory precision selection', () => {
  async function ortCreateMock() {
    const ort = await import('onnxruntime-web');
    return ort.InferenceSession.create as unknown as ReturnType<typeof vi.fn>;
  }

  function makeFactory() {
    return new RealEsrganSessionFactory({
      resolveModelUrl: (file: string) => `url:${file}`,
      modelAssetExists: async () => true,
      threading: { numThreads: 1 },
      execution: { preferFloat16: false, preferInt8: true },
    });
  }

  it('resolves the int8 model for int8 and the fp32 model for fp32', async () => {
    const create = await ortCreateMock();
    create.mockClear();
    const factory = makeFactory();
    await factory.createSession('RealEsrganX4', 64, 64, 'int8');
    await factory.createSession('RealEsrganX4', 64, 64, 'fp32');
    const urls = create.mock.calls.map(call => call[0] as string);
    expect(urls).toContain('url:RealESR-AnimeVideo-v3_x4.int8.static.onnx');
    expect(urls).toContain('url:RealESR-AnimeVideo-v3_x4.onnx');
  });

  it('caches per precision: same class+shape+precision builds once', async () => {
    const create = await ortCreateMock();
    create.mockClear();
    const factory = makeFactory();
    await factory.createSession('RealEsrganX4', 64, 64, 'fp32');
    await factory.createSession('RealEsrganX4', 64, 64, 'fp32');
    expect(create).toHaveBeenCalledTimes(1);
    await factory.createSession('RealEsrganX4', 64, 64, 'fp16');
    // fp16 is a different model file and must not reuse the fp32 session.
    expect(create).toHaveBeenCalledTimes(2);
    const urls = create.mock.calls.map(call => call[0] as string);
    expect(urls[1]).toContain('.fp16.onnx');
  });

  it('falls back to the factory execution config without an explicit precision', async () => {
    const create = await ortCreateMock();
    create.mockClear();
    const factory = makeFactory();
    await factory.createSession('RealEsrganX4', 64, 64);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0] as string)
      .toBe('url:RealESR-AnimeVideo-v3_x4.int8.static.onnx');
  });
});
