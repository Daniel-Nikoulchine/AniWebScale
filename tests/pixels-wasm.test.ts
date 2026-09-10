/**
 * Hebel E5 gate: WASM-SIMD compose vs the JS reference.
 *
 * - Byte-exact on integer-exact fixtures (all operations exactly
 *   representable: FMA contraction cannot diverge there).
 * - PSNR gate on procedural multi-tile frames (same operations, same order;
 *   only float association may differ by platform).
 * - Perf comparison (informational + soft faster-assert): the entire point
 *   of E5 is speed over the JS feather loop.
 */
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it, beforeAll, vi } from 'vitest';
// The worker assigns `self.onmessage` at module scope, so a `self` stub must
// exist BEFORE the import (same pattern as realesrgan-worker-frame.test.ts).
vi.hoisted(() => {
  (globalThis as { self?: unknown }).self = { postMessage: () => {} };
});
import {
  composeTilesToRgba8,
  planUniformTiles,
  singleTileMaxHeightForFrame,
  splitBatchedOutput,
  stackTilesToBatch,
} from '../src/worker/realesrgan-inference-worker.js';

interface PixelsModule {
  memory: WebAssembly.Memory;
  stage_ptr: (kind: number, lenBytes: number) => number;
  compose_exec: (
    outW: number, outH: number, feather: number,
    ntiles: number, tileOutW: number, tileOutH: number,
  ) => void;
  compose_output_ptr: () => number;
  compose_output_len: () => number;
}

let pixels: PixelsModule;
let pixelsAvailable = false;

beforeAll(async () => {
  // Cargo-less checkouts skip the gate loudly (generate warns); the worker
  // covers absence with its JS fallback, so the suite stays green.
  if (!existsSync('wasm/pixels.wasm')) {
    console.warn('[pixels-wasm] wasm/pixels.wasm missing (no cargo?) — gate skipped, JS fallback covers.');
    return;
  }
  pixelsAvailable = true;
  const bytes = readFileSync('wasm/pixels.wasm');
  const { instance } = await WebAssembly.instantiate(bytes, {});
  pixels = instance.exports as unknown as PixelsModule;
  for (const name of ['memory', 'stage_ptr', 'compose_exec', 'compose_output_ptr', 'compose_output_len']) {
    expect(pixels, `wasm export ${name}`).toHaveProperty(name);
  }
});

/** Run one compose through the module (mirrors the worker protocol).
 * `modelOut` is the staged batched model OUTPUT ([B,3,4h,4w] planar). */
function composeViaWasm(
  modelOut: Float32Array,
  tilesXY: Array<[number, number]>,
  tileOutW: number,
  tileOutH: number,
  outW: number,
  outH: number,
  feather: number,
): Uint8Array {
  const u8 = () => new Uint8Array(pixels.memory.buffer);
  const u32 = () => new Uint32Array(pixels.memory.buffer);
  const batchOff = pixels.stage_ptr(0, modelOut.byteLength);
  u8().set(new Uint8Array(modelOut.buffer, modelOut.byteOffset, modelOut.byteLength), batchOff);
  const descs = new Uint32Array(tilesXY.flatMap(([x, y]) => [x, y]));
  const descOff = pixels.stage_ptr(1, descs.byteLength);
  u32().set(descs, descOff / 4);
  pixels.compose_exec(outW, outH, feather, tilesXY.length, tileOutW, tileOutH);
  const ptr = pixels.compose_output_ptr();
  const len = pixels.compose_output_len();
  expect(len).toBe(outW * outH * 4);
  return u8().slice(ptr, ptr + len);
}

/** JS reference through the exported production helpers. */
function composeViaJs(
  frame: Float32Array,
  frameW: number,
  frameH: number,
  tiles: Array<{ x: number; y: number; width: number; height: number }>,
  outW: number,
  outH: number,
  feather: number,
): Uint8Array {
  const batch = stackTilesToBatch(frame, frameW, frameH, tiles);
  // Fake model: out = min(1, 2 * in), elementwise over the stacked batch.
  const fakeOut = new Float32Array(batch.length * 16);
  for (let i = 0; i < fakeOut.length; i += 1) {
    fakeOut[i] = Math.min(1, batch[i % batch.length] * 2);
  }
  return composeTilesToRgba8(splitBatchedOutput(fakeOut, tiles), outW, outH, feather);
}

function tileDescs(tiles: Array<{ x: number; y: number }>): Array<[number, number]> {
  return tiles.map(t => [t.x * 4, t.y * 4]);
}

function psnr(a: Uint8Array, b: Uint8Array): number {
  expect(a.length).toBe(b.length);
  let mse = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    mse += d * d;
  }
  mse /= a.length;
  if (mse === 0) return Number.POSITIVE_INFINITY;
  return 10 * Math.log10(255 * 255 / mse);
}

// Deterministic LCG (no test-time RNG dependence).
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('pixels.wasm compose', () => {
  it('is byte-identical on integer-exact fixtures', () => {

    if (!pixelsAvailable) return;
    // Constant 0.5, feather 48, two overlapping tiles: every f32 op is
    // exact (0.5 * int, small int sums, /int, *255, round) on any engine.
    const W = 4;
    const H = 600;
    const gate = singleTileMaxHeightForFrame(W, H, 512);
    const tiles = planUniformTiles(W, H, 512, 24, gate);
    expect(tiles).toHaveLength(2);
    const frame = new Float32Array(3 * W * H).fill(0.5);
    const tileOutW = tiles[0]!.width * 4;
    const tileOutH = tiles[0]!.height * 4;
    const batch = stackTilesToBatch(frame, W, H, tiles);
    const fakeOut = new Float32Array(batch.length * 16);
    for (let i = 0; i < fakeOut.length; i += 1) {
      fakeOut[i] = Math.min(1, batch[i % batch.length]! * 2);
    }
    const expected = composeTilesToRgba8(splitBatchedOutput(fakeOut, tiles), W * 4, H * 4, 48);
    // The module stages the batched model OUTPUT (fakeOut here), not inputs.
    const actual = composeViaWasm(fakeOut, tileDescs(tiles), tileOutW, tileOutH, W * 4, H * 4, 48);
    expect(actual).toEqual(expected);
  });

  it('matches the JS reference at high PSNR on procedural frames', () => {

    if (!pixelsAvailable) return;
    const W = 64;
    const H = 600;
    const gate = singleTileMaxHeightForFrame(W, H, 512);
    const tiles = planUniformTiles(W, H, 512, 24, gate);
    expect(tiles.length).toBeGreaterThan(1);
    const rand = lcg(77);
    const frame = new Float32Array(3 * W * H);
    for (let i = 0; i < frame.length; i += 1) frame[i] = rand();
    const tileOutW = tiles[0]!.width * 4;
    const tileOutH = tiles[0]!.height * 4;
    const expected = composeViaJs(frame, W, H, tiles, W * 4, H * 4, 48);
    const batch = stackTilesToBatch(frame, W, H, tiles);
    const fakeOut = new Float32Array(batch.length * 16);
    for (let i = 0; i < fakeOut.length; i += 1) {
      fakeOut[i] = Math.min(1, batch[i % batch.length]! * 2);
    }
    const actual = composeViaWasm(fakeOut, tileDescs(tiles), tileOutW, tileOutH, W * 4, H * 4, 48);
    const db = psnr(expected, actual);
    console.info(`[pixels-wasm] PSNR vs JS reference: ${db === Infinity ? 'inf' : db.toFixed(1)} dB`);
    // ~96 dB measured: max 1 LSB on a handful of bytes out of millions —
    // FMA-contraction noise (V8 fuses mul+add, wasm32 does not, or vice
    // versa), not a math difference. Far above the 50 dB
    // mathematically-equivalent tier.
    expect(db).toBeGreaterThanOrEqual(90);
  });

  it('reuses scratch across frames (growth path: small then large)', () => {

    if (!pixelsAvailable) return;
    const small = new Float32Array(3 * 4 * 600).fill(0.25);
    const tilesS = planUniformTiles(4, 600, 512, 24, singleTileMaxHeightForFrame(4, 600, 512));
    const batchS = stackTilesToBatch(small, 4, 600, tilesS);
    const fakeS = new Float32Array(batchS.length * 16);
    for (let i = 0; i < fakeS.length; i += 1) fakeS[i] = Math.min(1, batchS[i % batchS.length]! * 2);
    const outS = composeViaWasm(fakeS, tileDescs(tilesS), tilesS[0]!.width * 4, tilesS[0]!.height * 4, 16, 2400, 48);
    expect(outS.length).toBe(16 * 2400 * 4);
    // Larger second frame forces scratch growth; views are re-acquired.
    const big = new Float32Array(3 * 64 * 600).fill(0.75);
    const tilesB = planUniformTiles(64, 600, 512, 24, singleTileMaxHeightForFrame(64, 600, 512));
    const batchB = stackTilesToBatch(big, 64, 600, tilesB);
    const fakeB = new Float32Array(batchB.length * 16);
    for (let i = 0; i < fakeB.length; i += 1) fakeB[i] = Math.min(1, batchB[i % batchB.length]! * 2);
    const outB = composeViaWasm(fakeB, tileDescs(tilesB), tilesB[0]!.width * 4, tilesB[0]!.height * 4, 256, 2400, 48);
    expect(outB.length).toBe(256 * 2400 * 4);
    // Uniform 0.75 doubled and clamped = white everywhere.
    expect(outB[0]).toBe(255);
    expect(outB[3]).toBe(255);
  });

  it('is faster than the JS feather loop (the point of E5)', () => {

    if (!pixelsAvailable) return;
    const W = 320;
    const H = 300;
    const gate = singleTileMaxHeightForFrame(W, H, 512);
    const tiles = planUniformTiles(W, H, 512, 24, gate);
    const rand = lcg(9);
    const frame = new Float32Array(3 * W * H);
    for (let i = 0; i < frame.length; i += 1) frame[i] = rand();
    const tileOutW = tiles[0]!.width * 4;
    const tileOutH = tiles[0]!.height * 4;
    const batch = stackTilesToBatch(frame, W, H, tiles);
    const fakeOut = new Float32Array(batch.length * 16);
    for (let i = 0; i < fakeOut.length; i += 1) fakeOut[i] = Math.min(1, batch[i % batch.length]! * 2);
    const split = splitBatchedOutput(fakeOut, tiles);
    const tJs = performance.now();
    composeTilesToRgba8(split, W * 4, H * 4, 48);
    const jsMs = performance.now() - tJs;
    const tWasm = performance.now();
    composeViaWasm(fakeOut, tileDescs(tiles), tileOutW, tileOutH, W * 4, H * 4, 48);
    const wasmMs = performance.now() - tWasm;
    console.info(`[pixels-wasm] compose ${W * 4}x${H * 4}: js=${jsMs.toFixed(1)}ms wasm=${wasmMs.toFixed(1)}ms`);
    expect(wasmMs).toBeLessThan(jsMs);
  });
});
