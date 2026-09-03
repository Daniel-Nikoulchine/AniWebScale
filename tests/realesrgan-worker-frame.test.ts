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

interface PlannedTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkerExports {
  planUniformTiles: (width: number, height: number, maxTileSize: number, overlap: number, singleTileMaxHeight: number) => PlannedTile[];
  stackTilesToBatch: (inputRgb: Float32Array, sourceWidth: number, sourceHeight: number, tiles: PlannedTile[]) => Float32Array;
  splitBatchedOutput: (batched: Float32Array, tiles: PlannedTile[]) => Array<PlannedTile & { rgb: Float32Array }>;
  composeTilesToRgba8: (
    tiles: Array<{ x: number; y: number; width: number; height: number; rgb: Float32Array }>,
    outWidth: number,
    outHeight: number,
    featherWindow: number,
  ) => Uint8Array;
  downscaleRgba8Box: (
    rgba: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number,
  ) => Uint8Array;
  rewriteF16Bitcast: (code: string) => string;
  isBlackFrame: (rgba: Uint8Array) => boolean;
  handleInit: (message: { type: 'init'; ortUrl: string; wasmDir: string }) => Promise<void>;
  handleInfer: (message: {
    type: 'infer';
    id: number;
    modelUrl: string;
    modelUrlFp16: string | null;
    width: number;
    height: number;
    data: Float32Array;
    targetWidth?: number;
    targetHeight?: number;
  }) => Promise<void>;
  resetWorkerStateForTests: () => void;
  __setOrtLoaderForTests: (loader: ((url: string) => Promise<unknown>) | null) => void;
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
  error?: string;
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
}

interface SessionStub {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, { data: Float32Array }>) => Promise<Record<string, {
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
 * A 2x2-input fake ORT: batch dims come from the tensor length; the output
 * is [B,3,8,8] with values = 2 * input. Session creation fails the first
 * `createFailures` times.
 */
function makeFakeOrt(overrides: { createFailures?: number } = {}): OrtStub {
  let createCalls = 0;
  const created: Array<{ url: string; options: Record<string, unknown> }> = [];
  const session: SessionStub = {
    inputNames: ['input'],
    outputNames: ['output'],
    async run(feeds) {
      const input = feeds.input;
      const b = input.data.length / (3 * 2 * 2);
      const out = new Float32Array(b * 3 * 8 * 8);
      for (let i = 0; i < out.length; i += 1) {
        out[i] = Math.min(1, input.data[i % input.data.length] * 2);
      }
      return { output: { type: 'float32', dims: [b, 3, 8, 8], size: out.length, data: out } };
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
    await worker.handleInfer({
      type: 'infer', id: 1, modelUrl: 'fp32.onnx', modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    });
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
    await worker.handleInfer({
      type: 'infer', id: 2, modelUrl: 'fp32.onnx', modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    });
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
    await worker.handleInfer({
      type: 'infer', id: 4, modelUrl: 'fp32.onnx', modelUrlFp16: null,
      width: 2, height: 2, data: frame, targetWidth: 4, targetHeight: 4,
    });
    expect(replies[1].ok).toBe(true);
    expect(replies[1].width).toBe(4);
    expect(replies[1].height).toBe(4);
    const rgba = replies[1].data!;
    expect(rgba.length).toBe(4 * 4 * 4);
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
    await worker.handleInfer({
      type: 'infer', id: 5, modelUrl: 'fp32.onnx', modelUrlFp16: null,
      width: 2, height: 2, data: frame, targetWidth: 8, targetHeight: 8,
    });
    expect(replies[1].width).toBe(8);
    expect(replies[1].data!.length).toBe(8 * 8 * 4);

    await worker.handleInfer({
      type: 'infer', id: 6, modelUrl: 'fp32.onnx', modelUrlFp16: null,
      width: 2, height: 2, data: frame, targetWidth: 16, targetHeight: 16,
    });
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
            async run(feeds: Record<string, { data: Float32Array }>) {
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
    await worker.handleInfer({
      type: 'infer', id: 20, modelUrl: 'fp32.onnx', modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    });
    // Same-frame fp32 fallback: reply ok despite the fp16 shader failure.
    expect(replies[1].ok).toBe(true);
    expect(replies[1].width).toBe(8);
    expect(created.filter(u => u.includes('fp16'))).toHaveLength(1);

    // Sticky skip: the next frame reuses the cached fp32 session, no fp16 attempt.
    await worker.handleInfer({
      type: 'infer', id: 21, modelUrl: 'fp32.onnx', modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    });
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
    await worker.handleInfer({
      type: 'infer', id: 30, modelUrl: 'fp32.onnx', modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    });
    expect(replies[1].ok).toBe(false);
    expect(replies[1].error).toContain('timed out');
  });

  it('reports errors when every session creation fails', async () => {
    const replies = getReplies();
    const ort = makeFakeOrt({ createFailures: 99 });
    await initWorker(ort);

    const frame = new Float32Array(3 * 2 * 2);
    await worker.handleInfer({
      type: 'infer', id: 3, modelUrl: 'fp32.onnx', modelUrlFp16: 'fp16.onnx',
      width: 2, height: 2, data: frame,
    });
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
    await worker.handleInfer({
      type: 'infer', id: 10, modelUrl: 'fp32.onnx', modelUrlFp16: null,
      width: 2, height: 2, data: frame,
    });
    // Should succeed after one rebuild, not report failure
    expect(replies[1].ok).toBe(true);
    expect(replies[1].data).toBeInstanceOf(Uint8Array);
    expect(createCount).toBeGreaterThan(1);
    expect(runCalls).toBe(2);
  });
});

describe('isBlackFrame', () => {
  it('flags a fully black frame as black', () => {
    const rgba = new Uint8Array(8 * 8 * 4);
    // rgba already zeros -> black with alpha 0, but detector checks RGB <4 regardless of alpha
    expect(worker.isBlackFrame(rgba)).toBe(true);
  });

  it('does not flag a normal frame with mixed content and small black border', () => {
    const rgba = new Uint8Array(32 * 32 * 4).fill(128);
    for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = 255;
    // Add 2% black border (top rows)
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const o = (y * 32 + x) * 4;
        rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0;
      }
    }
    // Only ~6% dark -> should NOT be considered black (threshold 95%)
    expect(worker.isBlackFrame(rgba)).toBe(false);
  });

  it('does not flag a 50% dark frame as black', () => {
    const rgba = new Uint8Array(16 * 16 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      const pixel = i / 4;
      const isDark = pixel % 2 === 0;
      rgba[i] = isDark ? 0 : 200;
      rgba[i + 1] = isDark ? 0 : 200;
      rgba[i + 2] = isDark ? 0 : 200;
      rgba[i + 3] = 255;
    }
    expect(worker.isBlackFrame(rgba)).toBe(false);
  });

  it('flags a 99% black frame as black', () => {
    const rgba = new Uint8Array(32 * 32 * 4).fill(0);
    for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = 255;
    // Make 1% bright pixels
    for (let i = 0; i < 10; i += 1) {
      const o = i * 4;
      rgba[o] = 200; rgba[o + 1] = 200; rgba[o + 2] = 200;
    }
    expect(worker.isBlackFrame(rgba)).toBe(true);
  });

  it('handles tiny textures without crashing', () => {
    const rgba = new Uint8Array([0, 0, 0, 255]);
    expect(worker.isBlackFrame(rgba)).toBe(true);
    const rgba2 = new Uint8Array([200, 100, 50, 255]);
    expect(worker.isBlackFrame(rgba2)).toBe(false);
  });

  it('treats null/empty as black (safe fallback)', () => {
    expect(worker.isBlackFrame(null as unknown as Uint8Array)).toBe(true);
    expect(worker.isBlackFrame(new Uint8Array(0))).toBe(true);
  });
});
