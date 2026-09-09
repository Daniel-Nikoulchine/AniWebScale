import { describe, expect, it, beforeEach, vi } from 'vitest';
// The worker assigns `self.onmessage` at module scope, so a `self` stub must
// exist BEFORE the import. vi.hoisted() runs before the import is evaluated.
// The reply array is NOT returned from the hoisted factory (vitest
// structured-clones hoisted results, which would detach it from the
// postMessage closure) - tests read the live array off the stub instead.
vi.hoisted(() => {
  const replies: unknown[] = [];
  (globalThis as { self?: unknown }).self = {
    postMessage: (message: unknown) => {
      replies.push(message);
    },
    // Live handle for tests (postMessage closes over this exact array).
    __replies: replies,
  };
});
import * as workerNamespace from '../src/worker/realesrgan-inference-worker.js';
import type {
  WorkerInferMessage,
  WorkerInitMessage,
} from '../src/shared/realesrgan-worker-protocol.js';
import { buildWorkerInferMessage } from '../src/shared/realesrgan-worker-protocol.js';

interface PlannedTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkerExports {
  planUniformTiles: (width: number, height: number, maxTileSize: number, overlap: number, singleTileMaxHeight: number) => PlannedTile[];
  singleTileMaxHeightForFrame: (width: number, height: number, maxTileSize: number) => number;
  stackTilesToBatch: (inputRgb: Float32Array, sourceWidth: number, sourceHeight: number, tiles: PlannedTile[]) => Float32Array;
  splitBatchedOutput: (batched: Float32Array, tiles: PlannedTile[]) => Array<PlannedTile & { rgb: Float32Array }>;
  composeTilesToRgba8: (
    tiles: Array<{ x: number; y: number; width: number; height: number; rgb: Float32Array }>,
    outWidth: number,
    outHeight: number,
    featherWindow: number,
  ) => Uint8Array;
  composeSingleTileToRgba8: (rgb: Float32Array, width: number, height: number) => Uint8Array;
  downscaleRgba8Box: (
    rgba: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number,
  ) => Uint8Array;
  rewriteF16Bitcast: (code: string) => string;
  handleInit: (message: WorkerInitMessage) => Promise<void>;
  handleInfer: (message: WorkerInferMessage) => Promise<void>;
  getSession: (
    modelUrl: string,
    modelUrlFp16: string | null,
    inputBatch: number,
    inputHeight: number,
    inputWidth: number,
    outputHeight: number,
    outputWidth: number,
    wantGpuBuffer?: boolean,
  ) => Promise<{ session: unknown; url: string }>;
  purgeModelSessions: (modelUrl: string) => void;
  resetWorkerStateForTests: () => void;
  __setOrtLoaderForTests: (loader: ((url: string) => Promise<unknown>) | null) => void;
  __setPixelsLoaderForTests: (loader: ((url: string) => Promise<unknown>) | null) => void;
  __setPixelsModuleForTests: (mod: unknown) => void;
  __setSessionCreateTimeoutForTests: (ms: number) => void;
}

// Vite may serve the typeless .js through CJS-ESM interop (namespace carries
// the exports directly) or as an ESM module whose exports land on `default`
// (namespace.default). Resolve both shapes.
const workerNs = workerNamespace as unknown as Record<string, unknown>;
const worker = (
  typeof workerNs.planUniformTiles === 'function' ? workerNs : workerNs.default
) as unknown as WorkerExports;

type Reply = {
  type: string;
  id?: number;
  ok?: boolean;
  width?: number;
  height?: number;
  data?: Uint8Array;
  path?: string;
  fp16?: boolean;
  error?: string;
  code?: string;
};

interface OrtStub {
  Tensor: new (type: string, data: Float32Array, dims: number[]) => {
    type: string;
    data: Float32Array;
    dims: number[];
  };
  env: {
    wasm: Record<string, unknown>;
    webgpu: Record<string, unknown>;
  };
  InferenceSession: {
    create: (url: string, options: Record<string, unknown>) => Promise<SessionStub>;
  };
  __createCalls: () => number;
  __created: Array<{ url: string; options: Record<string, unknown> }>;
  __runCalls: () => number;
  __runDims: () => number[][];
}

interface SessionStub {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, { data: Float32Array; dims: number[] }>) => Promise<Record<string, {
    type: string;
    dims: number[];
    size: number;
    data: Float32Array;
  }>>;
}

function getReplies(): Reply[] {
  return (globalThis as { self?: { __replies?: Reply[] } }).self?.__replies ?? [];
}

/**
 * A fake ORT with dims-driven I/O: batch and tile dims come from the input
 * tensor, the output is 4x with values = 2 * input. Session creation fails
 * the first `createFailures` times; `run` throws for batched inputs when
 * `failBatch` is set (downgrade test). Every run's dims are recorded.
 */
function makeFakeOrt(overrides: { createFailures?: number; failBatch?: boolean } = {}): OrtStub {
  let createCalls = 0;
  const created: Array<{ url: string; options: Record<string, unknown> }> = [];
  const runDims: number[][] = [];
  let runCalls = 0;
  const session: SessionStub = {
    inputNames: ['input'],
    outputNames: ['output'],
    async run(feeds) {
      const input = feeds.input;
      runCalls += 1;
      runDims.push([...input.dims]);
      const [b, , h, w] = input.dims;
      if (overrides.failBatch && b > 1) throw new Error('simulated batch failure');
      const out = new Float32Array(b * 3 * (4 * h) * (4 * w));
      for (let i = 0; i < out.length; i += 1) {
        out[i] = Math.min(1, input.data[i % input.data.length] * 2);
      }
      return { output: { type: 'float32', dims: [b, 3, 4 * h, 4 * w], size: out.length, data: out } };
    },
  };
  const ort: OrtStub = {
    Tensor: class {
      type: string;
      data: Float32Array;
      dims: number[];
      constructor(type: string, data: Float32Array, dims: number[]) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    },
    env: { wasm: {}, webgpu: {} },
    InferenceSession: {
      create: async (url, options) => {
        createCalls += 1;
        created.push({ url, options });
        if (createCalls <= (overrides.createFailures ?? 0)) {
          throw new Error('simulated create failure');
        }
        return session;
      },
    },
    __createCalls: () => createCalls,
    __created: created,
    __runCalls: () => runCalls,
    __runDims: () => runDims.map(d => [...d]),
  };
  return ort;
}

async function initWorker(ort: OrtStub): Promise<void> {
  worker.__setOrtLoaderForTests(async () => ort);
  await worker.handleInit({ type: 'init', ortUrl: 'ort.mjs', wasmDir: 'ort/' });
}

describe('rewriteF16Bitcast', () => {
  it('rewrites the Naga-incompatible bitcast indexing', () => {
    const input = 'let x = bitcast<vec2<f16>>(uniforms.constant_value)[0];';
    expect(worker.rewriteF16Bitcast(input)).toBe(
      'let x = f16(unpack2x16float(uniforms.constant_value)[0]);',
    );
  });

  it('leaves other code untouched', () => {
    expect(worker.rewriteF16Bitcast('let y = vec2<f16>(1.0);')).toBe('let y = vec2<f16>(1.0);');
    expect(worker.rewriteF16Bitcast('plain')).toBe('plain');
  });
});

describe('planUniformTiles', () => {
  it('returns a single full-frame tile below singleTileMaxHeight', () => {
    expect(worker.planUniformTiles(640, 480, 512, 24, 576)).toEqual([
      { x: 0, y: 0, width: 640, height: 480 },
    ]);
  });

  it('splits tall frames with overlap and uniform tile shapes', () => {
    const tiles = worker.planUniformTiles(640, 900, 512, 24, 576);
    for (const tile of tiles) {
      expect(tile.width).toBe(512);
      expect(tile.height).toBe(512);
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(640);
      expect(tile.y + tile.height).toBeLessThanOrEqual(900);
    }
    const ys = [...new Set(tiles.map(t => t.y))];
    expect(ys[ys.length - 1]).toBe(900 - 512);
  });

  it('steps tiled axes by maxTileSize - overlap', () => {
    const tiles = worker.planUniformTiles(1920, 1080, 384, 24, 576);
    const ys = [...new Set(tiles.map(t => t.y))].sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBe(384 - 24);
  });

  it('Hebel 1.2: bounded 576 gate promotes 540p-class frames to single-tile', () => {
    expect(worker.singleTileMaxHeightForFrame(960, 540, 512)).toBe(576);
    expect(worker.singleTileMaxHeightForFrame(853, 480, 512)).toBe(576);
    expect(worker.singleTileMaxHeightForFrame(1920, 540, 512)).toBe(512);
    expect(worker.singleTileMaxHeightForFrame(1920, 1080, 384)).toBe(384);
    // End to end through the planner: one tile, not two overlapping ones.
    const gate = worker.singleTileMaxHeightForFrame(960, 540, 512);
    expect(worker.planUniformTiles(960, 540, 512, 24, gate)).toEqual([
      { x: 0, y: 0, width: 960, height: 540 },
    ]);
  });
});

describe('stackTilesToBatch / splitBatchedOutput', () => {
  it('round-trips a single-tile frame', () => {
    const width = 8;
    const height = 4;
    const pixels = width * height;
    const frame = new Float32Array(3 * pixels);
    for (let i = 0; i < frame.length; i += 1) frame[i] = i / frame.length;

    const tiles = worker.planUniformTiles(width, height, 512, 24, 576);
    expect(tiles).toHaveLength(1);
    const batch = worker.stackTilesToBatch(frame, width, height, tiles);
    expect(batch).toEqual(frame);

    const batchedOutput = new Float32Array(tiles.length * 3 * width * 4 * height * 4);
    batchedOutput.fill(0.5);
    const split = worker.splitBatchedOutput(batchedOutput, tiles);
    expect(split).toHaveLength(1);
    expect(split[0].rgb).toHaveLength(3 * width * 4 * height * 4);
  });
});

describe('composeTilesToRgba8', () => {
  it('composes a single tile: full-weight identity', () => {
    const rgb = new Float32Array(3 * 16).fill(0.5);
    const rgba = worker.composeTilesToRgba8(
      [{ x: 0, y: 0, width: 1, height: 1, rgb }],
      4, 4, 4,
    );
    for (let i = 0; i < rgba.length; i += 4) {
      expect(rgba[i]).toBe(Math.round(0.5 * 255));
      expect(rgba[i + 3]).toBe(255);
    }
  });

  it('blends overlapping tiles strictly between the tile values', () => {
    // Two 2x1-source tiles (8x4 output each) at source x=0 and x=1: A covers
    // output columns 0..7, B covers 4..11, so columns 4..7 genuinely overlap
    // and the feather ramp must blend them strictly between the tile values.
    const rgbA = new Float32Array(3 * 8 * 4).fill(0.2);
    const rgbB = new Float32Array(3 * 8 * 4).fill(0.8);
    const rgba = worker.composeTilesToRgba8(
      [
        { x: 0, y: 0, width: 2, height: 1, rgb: rgbA },
        { x: 1, y: 0, width: 2, height: 1, rgb: rgbB },
      ],
      12, 4, 8,
    );
    let blended = 0;
    let pureA = 0;
    let pureB = 0;
    for (let x = 0; x < 12; x += 1) {
      const v = rgba[(x * 4 + 1) * 4];
      if (v > Math.round(0.2 * 255) && v < Math.round(0.8 * 255)) blended += 1;
      if (v === Math.round(0.2 * 255)) pureA += 1;
      if (v === Math.round(0.8 * 255)) pureB += 1;
    }
    // Edge columns belong to one tile only; the overlap region must blend.
    expect(pureA).toBeGreaterThan(0);
    expect(pureB).toBeGreaterThan(0);
    expect(blended).toBeGreaterThan(0);
  });
});

describe('downscaleRgba8Box', () => {
  function solidRgba(width: number, height: number, r: number, g: number, b: number): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    return rgba;
  }

  it('returns identical pixels for identity dimensions', () => {
    const src = solidRgba(4, 4, 10, 20, 30);
    src[0] = 99;
    expect(worker.downscaleRgba8Box(src, 4, 4, 4, 4)).toEqual(src);
  });

  it('keeps uniform regions exactly uniform', () => {
    const out = worker.downscaleRgba8Box(solidRgba(8, 8, 200, 100, 50), 8, 8, 3, 3);
    expect(out.length).toBe(3 * 3 * 4);
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBe(200);
      expect(out[i + 1]).toBe(100);
      expect(out[i + 2]).toBe(50);
      expect(out[i + 3]).toBe(255);
    }
  });

  it('averages exact 2x2 quadrants without cross-talk', () => {
    // 4x4 source, one flat value per quadrant -> 2x2 keeps each value.
    const src = new Uint8Array(4 * 4 * 4);
    const values = [0, 85, 170, 255];
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const o = (y * 4 + x) * 4;
        const v = values[(y >> 1) * 2 + (x >> 1)];
        src[o] = v; src[o + 1] = v; src[o + 2] = v; src[o + 3] = 255;
      }
    }
    const out = worker.downscaleRgba8Box(src, 4, 4, 2, 2);
    for (let i = 0; i < 4; i += 1) {
      expect(out[i * 4]).toBe(values[i]);
      expect(out[i * 4 + 3]).toBe(255);
    }
  });

  it('forces opaque alpha like the native host box pass', () => {
    // Non-opaque input (never occurs in production — every writer sets
    // alpha 255): RGB still averages, alpha is forced to 255 on both the
    // integer and the float lane so worker and native agree by
    // construction instead of by input luck.
    const src = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 100; src[i + 1] = 150; src[i + 2] = 200; src[i + 3] = 0;
    }
    for (const [sw, sh, dw, dh] of [[4, 4, 2, 2], [4, 4, 1, 1], [8, 8, 8, 8]] as const) {
      const frame = new Uint8Array(sw * sh * 4);
      for (let i = 0; i < frame.length; i += 4) {
        frame[i] = 100; frame[i + 1] = 150; frame[i + 2] = 200; frame[i + 3] = 0;
      }
      const out = worker.downscaleRgba8Box(frame, sw, sh, dw, dh);
      for (let i = 0; i < out.length; i += 4) {
        expect(out[i]).toBe(100);
        expect(out[i + 1]).toBe(150);
        expect(out[i + 2]).toBe(200);
        expect(out[i + 3]).toBe(255);
      }
    }
  });
});

describe('worker protocol', () => {
  beforeEach(() => {
    worker.resetWorkerStateForTests();
    getReplies().length = 0;
  });

  it('init replies ok and stores wasm config', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);
    expect(replies).toEqual([{ type: 'init', ok: true }]);
    expect(ort.env.wasm.wasmPaths).toBe('ort/');
  });

  it('infer falls back from fp16 to fp32 model when creation fails', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt({ createFailures: 1 });
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 1,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    }));
    expect(replies[1].ok).toBe(true);
    expect(replies[1].width).toBe(8);
    expect(replies[1].height).toBe(8);
    expect(replies[1].data).toBeInstanceOf(Uint8Array);
    expect(replies[1].data!.length).toBe(8 * 8 * 4);
    // Per-tile GPU-only: fp16 no-gpu-buffer fails -> fp32 no-gpu-buffer succeeds.
    expect(ort.__createCalls()).toBe(2);
    expect(ort.__created[1].url).toBe('fp32.onnx');
    expect(ort.__created[1].options.executionProviders).toContain('webgpu');
  });

  it('infer composes to RGBA8 without a WebGPU device (CPU path)', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 2,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    }));
    expect(replies[1].ok).toBe(true);
    const rgba = replies[1].data!;
    expect(rgba.length).toBe(8 * 8 * 4);
    // Input 0.5 doubled -> 1.0 -> 255 everywhere, alpha opaque.
    expect(rgba[0]).toBe(255);
    expect(rgba[3]).toBe(255);
  });

  it('infer box-averages down to a valid presentation target', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 4,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame, targetWidth: 4, targetHeight: 4,
    }));
    expect(replies[1].ok).toBe(true);
    expect(replies[1].width).toBe(4);
    expect(replies[1].height).toBe(4);
    const rgba = replies[1].data!;
    expect(rgba.length).toBe(4 * 4 * 4);
    // The downscale suffix preserves the serving lane (single-tile here).
    expect(replies[1].path).toBe('cpu-single-gpu-downscaled');
    // Uniform 8x8 white downscaled stays white.
    for (let i = 0; i < rgba.length; i += 4) {
      expect(rgba[i]).toBe(255);
      expect(rgba[i + 3]).toBe(255);
    }
  });

  it('infer keeps the full 4x frame for absent or out-of-range targets', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 5,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame, targetWidth: 8, targetHeight: 8,
    }));
    expect(replies[1].width).toBe(8);
    expect(replies[1].data!.length).toBe(8 * 8 * 4);

    await worker.handleInfer(buildWorkerInferMessage({
      id: 6,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame, targetWidth: 16, targetHeight: 16,
    }));
    expect(replies[2].width).toBe(8);
    expect(replies[2].data!.length).toBe(8 * 8 * 4);
  });

  it('infer retries the frame on fp32 after an fp16 shader failure, then skips fp16', async () => {
    const replies = getReplies();
    const created: string[] = [];
    const baseOrt = makeFakeOrt();
    const ort: OrtStub = {
      ...baseOrt,
      InferenceSession: {
        create: async (url: string) => {
          created.push(url);
          const session = await baseOrt.InferenceSession.create(url, {});
          const isFp16 = url.includes('fp16');
          return {
            ...session,
            async run(feeds: Record<string, { data: Float32Array; dims: number[] }>) {
              if (isFp16) {
                throw new Error('Failed to create a WebGPU compute pipeline: [Invalid ShaderModule "Clip"] is invalid');
              }
              return session.run(feeds);
            },
          };
        },
      },
    };
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 20,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    }));
    // Same-frame fp32 fallback: reply ok despite the fp16 shader failure.
    expect(replies[1].ok).toBe(true);
    expect(replies[1].width).toBe(8);
    expect(created.filter(u => u.includes('fp16'))).toHaveLength(1);

    // Sticky skip: the next frame reuses the cached fp32 session, no fp16 attempt.
    await worker.handleInfer(buildWorkerInferMessage({
      id: 21,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    }));
    expect(replies[2].ok).toBe(true);
    expect(created.filter(u => u.includes('fp16'))).toHaveLength(1);
    expect(created.filter(u => u === 'fp32.onnx')).toHaveLength(1);
  });

  it('infer fails fast instead of hanging when session creation stalls', async () => {
    const replies = getReplies();
    const baseOrt = makeFakeOrt();
    const ort: OrtStub = {
      ...baseOrt,
      InferenceSession: {
        create: () => new Promise<SessionStub>(() => {}),
      },
    };
    await initWorker(ort);
    worker.__setSessionCreateTimeoutForTests(30);

    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 30,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    }));
    expect(replies[1].ok).toBe(false);
    expect(replies[1].error).toContain('timed out');
  });

  it('reports errors when every session creation fails', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt({ createFailures: 99 });
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 3,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    }));
    expect(replies[1].ok).toBe(false);
    expect(replies[1].error).toContain('simulated create failure');
  });

  it('recovers from shape-pinned buffer errors by rebuilding the session', async () => {
    const replies = getReplies();
    let runCalls = 0;
    const baseOrt = makeFakeOrt();
    const flakySession: SessionStub = {
      inputNames: ['input'],
      outputNames: ['output'],
      async run(feeds) {
        runCalls += 1;
        if (runCalls === 1) {
          // First batched run hits the WebGPU EP's shape-pinned buffer bug
          throw new Error('Shape mismatch attempting to re-use buffer. {1,480,640,3} != {1,1920,2560,3}');
        }
        // Retry after rebuild succeeds
        const input = feeds.input;
        const b = input.data.length / (3 * 2 * 2);
        const out = new Float32Array(b * 3 * 8 * 8).fill(0.7);
        return { output: { type: 'float32', dims: [b, 3, 8, 8], size: out.length, data: out } };
      },
    };
    let createCount = 0;
    const ort: OrtStub = {
      ...baseOrt,
      InferenceSession: {
        create: async (url, options) => {
          createCount += 1;
          baseOrt.__created.push({ url, options });
          return flakySession;
        },
      },
      __createCalls: () => createCount,
      __created: baseOrt.__created,
    };
    await initWorker(ort);
    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 10,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    }));
    // Should succeed after one rebuild, not report failure
    expect(replies[1].ok).toBe(true);
    expect(replies[1].data).toBeInstanceOf(Uint8Array);
    expect(createCount).toBeGreaterThan(1);
    expect(runCalls).toBe(2);
  });

  it('reports fp32 when the shape-pinned rebuild resolves away from fp16', async () => {
    const replies = getReplies();
    let runs = 0;
    const session = {
      inputNames: ['input'],
      outputNames: ['output'],
      async run(feeds: { input: { dims: number[] } }) {
        runs += 1;
        if (runs === 1) throw new Error('Shape mismatch attempting to re-use buffer');
        const [b, , h, w] = feeds.input.dims;
        const out = new Float32Array(b * 3 * (4 * h) * (4 * w)).fill(0.5);
        return { output: { type: 'float32', dims: [b, 3, 4 * h, 4 * w], size: out.length, data: out } };
      },
    };
    let creates = 0;
    const ort = {
      Tensor: class {
        type: string;
        data: Float32Array;
        dims: number[];
        constructor(type: string, data: Float32Array, dims: number[]) {
          this.type = type;
          this.data = data;
          this.dims = dims;
        }
      },
      env: { wasm: {}, webgpu: {} },
      InferenceSession: {
        create: async (url: string) => {
          creates += 1;
          // fp16 serves the first attempt, then flakes: the rebuild must
          // fall through to fp32 and the reply must say so.
          if (url === 'fp16-test.onnx' && creates > 1) throw new Error('flaky fp16 device loss');
          return session;
        },
      },
    };
    await initWorker(ort as unknown as OrtStub);
    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 41,
      modelUrl: 'fp32-test.onnx',
      modelUrlFp16: 'fp16-test.onnx',
      width: 2, height: 2, data: frame,
    }));
    const reply = replies[replies.length - 1];
    expect(reply.ok).toBe(true);
    // Stale probe.url (fp16) would mislabel this frame fp16.
    expect(reply.fp16).toBe(false);
  });
});

describe('session cache management (purge boundary, LRU cap)', () => {
  beforeEach(() => {
    worker.resetWorkerStateForTests();
    getReplies().length = 0;
  });

  async function sessionFor(ort: OrtStub, width: number, modelUrl = 'https://cdn/m/x4.onnx') {
    worker.__setOrtLoaderForTests(async () => ort);
    await worker.handleInit({ type: 'init', ortUrl: 'ort.mjs', wasmDir: 'ort/' });
    return worker.getSession(modelUrl, null, 1, 64, width, 256, width * 4, false);
  }

  it('purge keeps models whose URL merely extends the purged one', async () => {
    const ort = makeFakeOrt();
    await sessionFor(ort, 64, 'https://cdn/m/x4.onnx');
    await sessionFor(ort, 64, 'https://cdn/m/x4.onnx2');
    expect(ort.__createCalls()).toBe(2);

    worker.purgeModelSessions('https://cdn/m/x4.onnx');

    // The x4.onnx2 entry survives: same dims hit the cache, no rebuild.
    await sessionFor(ort, 64, 'https://cdn/m/x4.onnx2');
    expect(ort.__createCalls()).toBe(2);
    // The purged entry rebuilds on next use.
    await sessionFor(ort, 64, 'https://cdn/m/x4.onnx');
    expect(ort.__createCalls()).toBe(3);
  });

  it('evicts the stalest session past the cap and keeps hot ones', async () => {
    const ort = makeFakeOrt();
    for (let width = 64; width < 64 + 17; width += 1) {
      await sessionFor(ort, width);
    }
    expect(ort.__createCalls()).toBe(17);

    // Width 64 was inserted first: evicted, so it rebuilds.
    await sessionFor(ort, 64);
    expect(ort.__createCalls()).toBe(18);
    // The newest entry survived eviction: cache hit, no rebuild.
    await sessionFor(ort, 64 + 16);
    expect(ort.__createCalls()).toBe(18);
  });

  it('adopts a late session creation for the next frame', async () => {
    const baseOrt = makeFakeOrt();
    let creates = 0;
    let releaseCreate!: (session: SessionStub) => void;
    const ort: OrtStub = {
      ...baseOrt,
      InferenceSession: {
        create: () => {
          creates += 1;
          return new Promise<SessionStub>(resolve => {
            releaseCreate = resolve;
          });
        },
      },
    };
    await initWorker(ort);
    worker.__setSessionCreateTimeoutForTests(10);

    // First call times out while creation is still pending.
    await expect(sessionFor(ort, 64)).rejects.toThrow('timed out');
    expect(creates).toBe(1);
    // The late creation lands afterwards and is adopted for the key, so the
    // next frame is served from it without a second creation.
    releaseCreate({ inputNames: ['input'], outputNames: ['output'], run: async () => ({}) });
    await new Promise(resolve => setTimeout(resolve, 0));
    await sessionFor(ort, 64);
    expect(creates).toBe(1);
  });

  it('disables fp16 worker-wide after a create-time shader failure', async () => {
    const created: string[] = [];
    const baseOrt = makeFakeOrt();
    const ort: OrtStub = {
      ...baseOrt,
      InferenceSession: {
        create: async (url: string) => {
          created.push(url);
          if (url === 'fp16.onnx') throw new Error('failed to create compute pipeline: Invalid ShaderModule');
          return { inputNames: ['input'], outputNames: ['output'], run: async () => ({}) } as unknown as SessionStub;
        },
      },
    };
    worker.__setOrtLoaderForTests(async () => ort);
    await worker.handleInit({ type: 'init', ortUrl: 'ort.mjs', wasmDir: 'ort/' });

    await worker.getSession('fp32.onnx', 'fp16.onnx', 1, 64, 64, 256, 256, false);
    expect(created).toEqual(['fp16.onnx', 'fp32.onnx']);
    // A new shape must not pay another doomed fp16 create.
    await worker.getSession('fp32.onnx', 'fp16.onnx', 1, 32, 32, 128, 128, false);
    expect(created).toEqual(['fp16.onnx', 'fp32.onnx', 'fp32.onnx']);
  });
});

describe('batched tile inference (Hebel 2.2)', () => {
  beforeEach(() => {
    worker.resetWorkerStateForTests();
    getReplies().length = 0;
  });

  // 4x600 forces two uniform 4x512 tiles (gate 576 via
  // singleTileMaxHeightForFrame, tileAxis spill [0, 88]).
  const W = 4;
  const H = 600;
  const gate = 576;

  function tiledFrame(): Float32Array {
    const frame = new Float32Array(3 * W * H);
    for (let i = 0; i < frame.length; i += 1) frame[i] = (i % 251) / 251;
    return frame;
  }

  it('keeps batching armed after a single transient batch timeout', async () => {
    const replies = getReplies();
    let runs = 0;
    const runDims: number[][] = [];
    const session = {
      inputNames: ['input'],
      outputNames: ['output'],
      async run(feeds: { input: { data: Float32Array; dims: number[] } }) {
        runs += 1;
        runDims.push([...feeds.input.dims]);
        if (runs === 1) {
          const timeout = new Error('simulated batch slowness');
          (timeout as unknown as Record<string, unknown>).replyCode = 'worker-timeout';
          throw timeout;
        }
        const [b, , h, w] = feeds.input.dims;
        const out = new Float32Array(b * 3 * (4 * h) * (4 * w)).fill(0.5);
        return { output: { type: 'float32', dims: [b, 3, 4 * h, 4 * w], size: out.length, data: out } };
      },
    };
    const baseOrt = makeFakeOrt();
    const ort: OrtStub = {
      ...baseOrt,
      Tensor: baseOrt.Tensor,
      env: baseOrt.env,
      InferenceSession: { create: async () => session as unknown as SessionStub },
      __createCalls: baseOrt.__createCalls,
      __created: baseOrt.__created,
      __runCalls: baseOrt.__runCalls,
      __runDims: baseOrt.__runDims,
    };
    await initWorker(ort);

    // First frame: batched attempt times out once, served sequentially —
    // batching must stay armed for the next frame.
    await worker.handleInfer(buildWorkerInferMessage({
      id: 50, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: W, height: H, data: tiledFrame(),
    }));
    expect(replies[replies.length - 1].ok).toBe(true);
    // Second frame: still batched (batch dim 2 on the first run).
    await worker.handleInfer(buildWorkerInferMessage({
      id: 51, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: W, height: H, data: tiledFrame(),
    }));
    expect(replies[replies.length - 1].ok).toBe(true);
    const secondFrameFirstRun = runDims[3];
    expect(secondFrameFirstRun?.[0]).toBe(2);
  });

  function expectedTiles() {
    return worker.planUniformTiles(W, H, 512, 24, gate);
  }

  it('runs multi-tile frames in ONE session.run with [B,3,h,w] dims', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);
    const tiles = expectedTiles();
    expect(tiles).toHaveLength(2);

    await worker.handleInfer(buildWorkerInferMessage({
      id: 30,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: W, height: H, data: tiledFrame(),
    }));
    expect(replies[1].ok).toBe(true);
    expect(replies[1].width).toBe(W * 4);
    expect(replies[1].height).toBe(H * 4);
    expect(replies[1].data!.length).toBe(W * 4 * H * 4 * 4);
    // Exactly one launch for the whole frame (was: one per tile).
    expect(ort.__runCalls()).toBe(1);
    expect(ort.__runDims()).toEqual([[2, 3, 512, 4]]);
    expect(replies[1].path).toBe('cpu-tiles-batched-gpu');
  });

  it('batched result matches the sequential reference composition', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);
    const frame = tiledFrame();
    const tiles = expectedTiles();

    await worker.handleInfer(buildWorkerInferMessage({
      id: 31,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: W, height: H, data: frame,
    }));
    // Independent reference through the exported (unit-tested) helpers with
    // the same per-tile fake math (out = min(1, 2 * in)): apply the fake's
    // elementwise rule to the stacked batch, split, and compose — the same
    // order the worker uses.
    const batch = worker.stackTilesToBatch(frame, W, H, tiles);
    const fakeOut = new Float32Array(batch.length * 16);
    for (let i = 0; i < fakeOut.length; i += 1) {
      fakeOut[i] = Math.min(1, batch[i % batch.length] * 2);
    }
    const split = worker.splitBatchedOutput(fakeOut, tiles);
    const reference = worker.composeTilesToRgba8(split, W * 4, H * 4, 48);
    expect(replies[1].data).toEqual(reference);
  });

  it('downgrades sticky-sequential when batching fails, still serving frames', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt({ failBatch: true });
    await initWorker(ort);
    const frame = tiledFrame();

    await worker.handleInfer(buildWorkerInferMessage({
      id: 32,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: W, height: H, data: frame,
    }));
    expect(replies[1].ok).toBe(true);
    expect(replies[1].data!.length).toBe(W * 4 * H * 4 * 4);
    // One failed batch attempt + two sequential tile runs.
    expect(ort.__runCalls()).toBe(3);
    expect(ort.__runDims()[0]).toEqual([2, 3, 512, 4]);
    // Second frame skips the doomed batch attempt: two sequential runs only.
    await worker.handleInfer(buildWorkerInferMessage({
      id: 33,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: W, height: H, data: frame,
    }));
    expect(replies[2].ok).toBe(true);
    expect(ort.__runCalls()).toBe(5);
    expect(ort.__runDims().slice(3)).toEqual([[1, 3, 512, 4], [1, 3, 512, 4]]);
    // Sequential lanes report distinctly from the batched lane.
    expect(replies[1].path).toBe('cpu-tiles-sequential-gpu');
    expect(replies[2].path).toBe('cpu-tiles-sequential-gpu');
  });
});

describe('wasm-simd compose (Hebel E5)', () => {
  beforeEach(() => {
    worker.resetWorkerStateForTests();
    getReplies().length = 0;
    worker.__setPixelsModuleForTests(null);
  });

  it('shares one wasm load across concurrent first frames', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    worker.__setOrtLoaderForTests(async () => ort);
    await worker.handleInit({ type: 'init', ortUrl: 'ort.mjs', wasmDir: 'ort/', pixelsUrl: 'pixels.wasm' });
    let loads = 0;
    let releaseLoad!: (mod: unknown) => void;
    worker.__setPixelsLoaderForTests(() => {
      loads += 1;
      return new Promise<unknown>(resolve => { releaseLoad = resolve; });
    });
    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    const first = worker.handleInfer(buildWorkerInferMessage({
      id: 60, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: 2, height: 2, data: frame,
    }));
    const second = worker.handleInfer(buildWorkerInferMessage({
      id: 61, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: 2, height: 2, data: frame,
    }));
    // Both frames pile onto the same in-flight load (which then fails
    // export validation and falls back to JS for both). Flush microtasks
    // first: the frames reach the loader through the session/run chain.
    for (let i = 0; i < 1000 && loads === 0; i += 1) await Promise.resolve();
    expect(loads).toBe(1);
    releaseLoad({});
    await Promise.all([first, second]);
    expect(loads).toBe(1);
    expect(replies.filter(r => r.type === 'infer' && r.ok)).toHaveLength(2);
  });

  it('serves concurrent first frames from the shared load once it succeeds', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    worker.__setOrtLoaderForTests(async () => ort);
    await worker.handleInit({ type: 'init', ortUrl: 'ort.mjs', wasmDir: 'ort/', pixelsUrl: 'pixels.wasm' });
    const pixels = makeFakePixels();
    // Single-tile 8x8 compose output for the 2x2 frame's 4x result.
    pixels.setOutput(new Uint8Array(8 * 8 * 4).fill(0xab));
    let loads = 0;
    let releaseLoad!: (mod: unknown) => void;
    worker.__setPixelsLoaderForTests(() => {
      loads += 1;
      return new Promise<unknown>(resolve => { releaseLoad = resolve; });
    });
    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    const first = worker.handleInfer(buildWorkerInferMessage({
      id: 62, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: 2, height: 2, data: frame,
    }));
    const second = worker.handleInfer(buildWorkerInferMessage({
      id: 63, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: 2, height: 2, data: frame,
    }));
    for (let i = 0; i < 1000 && loads === 0; i += 1) await Promise.resolve();
    releaseLoad(pixels);
    await Promise.all([first, second]);
    expect(loads).toBe(1);
    // Old code served the second frame from JS (it saw the attempted flag
    // and never awaited the load); shared loading serves wasm to both.
    expect(replies.filter(r => r.type === 'infer').map(r => r.path))
      .toEqual(['cpu-single-wasm', 'cpu-single-wasm']);
  });

  it('retries the wasm load after the cooldown, not on every frame', async () => {
    vi.useFakeTimers();
    try {
      const replies = getReplies();
      const ort = makeFakeOrt();
      worker.__setOrtLoaderForTests(async () => ort);
      await worker.handleInit({ type: 'init', ortUrl: 'ort.mjs', wasmDir: 'ort/', pixelsUrl: 'pixels.wasm' });
      let loads = 0;
      worker.__setPixelsLoaderForTests(() => {
        loads += 1;
        return Promise.reject(new Error('transient fetch hiccup'));
      });
      const frame = new Float32Array(3 * 2 * 2).fill(0.5);
      const infer = (id: number) => worker.handleInfer(buildWorkerInferMessage({
        id, modelUrl: 'fp32.onnx', modelUrlFp16: null, width: 2, height: 2, data: frame,
      }));
      await infer(62);
      expect(loads).toBe(1);
      // Inside the cooldown: no refetch, JS serves.
      await infer(63);
      expect(loads).toBe(1);
      // Past the cooldown: one retry, then quiet again.
      await vi.advanceTimersByTimeAsync(61_000);
      await infer(64);
      expect(loads).toBe(2);
      expect(replies.filter(r => r.type === 'infer' && r.ok)).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Fake pixels module: serves canned bytes from its own memory. */
  function makeFakePixels() {
    const memory = new WebAssembly.Memory({ initial: 16 });
    const calls: string[] = [];
    let pending = new Uint8Array(0);
    return {
      calls,
      memory,
      setOutput: (bytes: Uint8Array) => { pending = bytes; },
      stage_ptr: (kind: number, len: number) => {
        calls.push(`stage:${kind}:${len}`);
        return 64;
      },
      compose_exec: (...args: number[]) => {
        calls.push(`exec:${args.join(',')}`);
        new Uint8Array(memory.buffer, 64, pending.length).set(pending);
      },
      compose_single_exec: (pixels: number) => {
        calls.push(`single:${pixels}`);
        new Uint8Array(memory.buffer, 64, pending.length).set(pending);
      },
      compose_output_ptr: () => 64,
      compose_output_len: () => pending.length,
    };
  }

  it('composeSingleTileToRgba8 converts planar exactly', () => {
    const rgb = new Float32Array([0, 0.5, 1, 0.25, 0.75, 0, 1, 0.5, 0.25, 0, 1, 0.75]);
    expect(worker.composeSingleTileToRgba8(rgb, 2, 2)).toEqual(new Uint8Array([
      0, 191, 64, 255,
      128, 0, 0, 255,
      255, 255, 255, 255,
      64, 128, 191, 255,
    ]));
    expect(() => worker.composeSingleTileToRgba8(new Float32Array(7), 2, 2)).toThrow();
  });

  it('single-lane matches the full lane at high PSNR', () => {
    let state = 4242;
    const rand = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const rgb = new Float32Array(3 * 32 * 32);
    for (let i = 0; i < rgb.length; i += 1) rgb[i] = rand();
    const fast = worker.composeSingleTileToRgba8(rgb, 32, 32);
    const full = worker.composeTilesToRgba8(
      [{ x: 0, y: 0, width: 8, height: 8, rgb }], 32, 32, 48,
    );
    let mse = 0;
    for (let i = 0; i < fast.length; i += 1) {
      const d = (fast[i] ?? 0) - (full[i] ?? 0);
      mse += d * d;
    }
    mse /= fast.length;
    const db = mse === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10(255 * 255 / mse);
    expect(db).toBeGreaterThanOrEqual(100);
  });

  it('serves single-tile frames via the wasm single lane', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);
    const pixels = makeFakePixels();
    worker.__setPixelsModuleForTests(pixels);
    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    // Fake model output doubled to white; canned reply must pass through.
    const white = new Uint8Array(8 * 8 * 4).fill(255);
    pixels.setOutput(white);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 40,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    }));
    expect(replies[1].ok).toBe(true);
    expect(replies[1].path).toBe('cpu-single-wasm');
    expect(replies[1].data).toEqual(white);
    expect(pixels.calls.some(c => c.startsWith('single:'))).toBe(true);
    expect(pixels.calls.some(c => c.startsWith('exec:'))).toBe(false);
  });

  it('serves multi-tile frames via the wasm multi lane', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);
    const pixels = makeFakePixels();
    worker.__setPixelsModuleForTests(pixels);
    const W = 4;
    const H = 600;
    const frame = new Float32Array(3 * W * H).fill(0.25);
    const out = new Uint8Array(W * 4 * H * 4 * 4).fill(7);
    pixels.setOutput(out);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 41,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: W, height: H, data: frame,
    }));
    expect(replies[1].ok).toBe(true);
    expect(replies[1].path).toBe('cpu-tiles-wasm');
    expect(replies[1].data).toEqual(out);
    expect(pixels.calls).toContain('exec:16,2400,48,2,16,2048');
  });

  it('falls back to JS lanes when the wasm module traps (sticky)', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt();
    await initWorker(ort);
    const pixels = makeFakePixels();
    pixels.compose_single_exec = () => { throw new Error('simulated wasm trap'); };
    worker.__setPixelsModuleForTests(pixels);
    const frame = new Float32Array(3 * 2 * 2).fill(0.5);
    await worker.handleInfer(buildWorkerInferMessage({
      id: 42,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    }));
    // Fake model doubles 0.5 to white; JS single lane serves it.
    expect(replies[1].ok).toBe(true);
    expect(replies[1].path).toBe('cpu-single-gpu');
    expect(replies[1].data![0]).toBe(255);
    const callsAfterFirst = pixels.calls.length;
    await worker.handleInfer(buildWorkerInferMessage({
      id: 43,
      modelUrl: 'fp32.onnx',
      modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    }));
    expect(replies[2].path).toBe('cpu-single-gpu');
    // Sticky disable: no further wasm calls after the trap.
    expect(pixels.calls.length).toBe(callsAfterFirst);
  });
});
