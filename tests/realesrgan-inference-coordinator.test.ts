import { describe, expect, it, vi } from 'vitest';
import type { InferenceSession } from 'onnxruntime-web';
import { RealEsrganInferenceCoordinator, type RealEsrganInferenceHost } from '../src/core/realesrgan-inference-coordinator';
import type { RealEsrganFrameResult, RealEsrganInferenceRunner } from '../src/core/realesrgan-runner';

vi.mock('onnxruntime-web', () => ({
  env: { wasm: {} },
  InferenceSession: { create: vi.fn() },
  Tensor: class {
    constructor(
      public readonly type: string,
      public readonly data: unknown,
      public readonly dims: number[],
    ) {}
  },
}));

function makeHost(runner: RealEsrganInferenceRunner | null): RealEsrganInferenceHost {
  return {
    getRunner: () => runner,
    guardInference: task => task(),
    inferenceWidth: 64,
    inferenceHeight: 64,
  };
}

const RESULT: RealEsrganFrameResult = {
  data: new Uint8Array(4),
  width: 2,
  height: 2,
};

function fakeSession(): InferenceSession {
  return {
    inputNames: ['input'],
    outputNames: ['output'],
    run: vi.fn(async () => ({ output: { data: new Float32Array([1, 2, 3, 4]) } })),
  } as unknown as InferenceSession;
}

describe('RealEsrganInferenceCoordinator', () => {
  describe('runner wrappers', () => {
    it('runWorkerInference delegates to the runner and the guard', async () => {
      const runFrame = vi.fn(async () => RESULT);
      let guardCalls = 0;
      const host: RealEsrganInferenceHost = {
        ...makeHost({ runFrame }),
        guardInference: task => { guardCalls += 1; return task(); },
      };
      const coordinator = new RealEsrganInferenceCoordinator(host, null);
      const input = new Float32Array(3 * 8 * 8);

      await expect(coordinator.runWorkerInference('u', 'f16', input, 8, 8, 0, 0)).resolves.toBe(RESULT);
      expect(runFrame).toHaveBeenCalledWith('u', 'f16', 8, 8, input, 0, 0);
      expect(guardCalls).toBe(1);
    });

    it('runWorkerInference throws without a runner', async () => {
      const coordinator = new RealEsrganInferenceCoordinator(makeHost(null), null);
      await expect(coordinator.runWorkerInference('u', null, new Float32Array(3), 1, 1, 0, 0))
        .rejects.toThrow('RealESRGAN runner binding is unavailable.');
    });

    it('runNativeRgbaFrame delegates to the RGBA fast path only when offered', async () => {
      const runFrameRgba = vi.fn(async () => RESULT);
      const coordinator = new RealEsrganInferenceCoordinator(
        makeHost({ runFrame: vi.fn(async () => RESULT), runFrameRgba }),
        null,
      );
      const rgba = new Uint8Array(4);
      await expect(coordinator.runNativeRgbaFrame('u', rgba, 8, 8, 0, 0)).resolves.toBe(RESULT);
      expect(runFrameRgba).toHaveBeenCalledWith('u', 8, 8, rgba, 0, 0);

      const plain = new RealEsrganInferenceCoordinator(makeHost({ runFrame: vi.fn(async () => RESULT) }), null);
      await expect(plain.runNativeRgbaFrame('u', rgba, 8, 8, 0, 0))
        .rejects.toThrow('RealESRGAN RGBA runner binding is unavailable.');
    });
  });

  describe('fallback session memo', () => {
    it('memoizes per shape and keys the full-shape warmup handle', async () => {
      const session = fakeSession();
      const getSession = vi.fn(async () => session);
      const coordinator = new RealEsrganInferenceCoordinator(makeHost(null), getSession);

      const a = coordinator.ensureFallbackSessionFor(8, 8);
      const b = coordinator.ensureFallbackSessionFor(8, 8);
      expect(a).toBe(b);
      await expect(a).resolves.toBe(session);
      expect(getSession).toHaveBeenCalledTimes(1);

      // The full-shape warmup asks for the host's inference dimensions.
      await expect(coordinator.ensureFallbackSession()).resolves.toBe(session);
      expect(getSession).toHaveBeenLastCalledWith(64, 64);
      expect(getSession).toHaveBeenCalledTimes(2);
    });

    it('drops a rejected build so the next call retries', async () => {
      const session = fakeSession();
      const getSession = vi.fn()
        .mockRejectedValueOnce(new Error('build failed'))
        .mockResolvedValueOnce(session);
      const coordinator = new RealEsrganInferenceCoordinator(makeHost(null), getSession);

      await expect(coordinator.ensureFallbackSessionFor(8, 8)).rejects.toThrow('build failed');
      await expect(coordinator.ensureFallbackSessionFor(8, 8)).resolves.toBe(session);
      expect(getSession).toHaveBeenCalledTimes(2);
    });

    it('rejects when no session factory is wired', async () => {
      const coordinator = new RealEsrganInferenceCoordinator(makeHost(null), null);
      await expect(coordinator.ensureFallbackSessionFor(8, 8))
        .rejects.toThrow('RealESRGAN main-thread fallback session is unavailable.');
    });
  });

  describe('runSessionInference', () => {
    it('builds a float32 tensor, runs the session and returns the output data', async () => {
      const session = fakeSession();
      const getSession = vi.fn(async () => session);
      const coordinator = new RealEsrganInferenceCoordinator(makeHost(null), getSession);
      const tile = new Float32Array(3 * 4 * 4);

      const out = await coordinator.runSessionInference(tile, 4, 4);

      expect(getSession).toHaveBeenCalledWith(4, 4);
      expect(out).toEqual(new Float32Array([1, 2, 3, 4]));
      const run = session.run as unknown as ReturnType<typeof vi.fn>;
      expect(run).toHaveBeenCalledOnce();
      expect(Object.keys(run.mock.calls[0][0] as object)).toEqual(['input']);
    });

    it('throws when the session returns no output tensor', async () => {
      const session = {
        inputNames: ['input'],
        outputNames: ['output'],
        run: vi.fn(async () => ({})),
      } as unknown as InferenceSession;
      const coordinator = new RealEsrganInferenceCoordinator(makeHost(null), async () => session);

      await expect(coordinator.runSessionInference(new Float32Array(3 * 4 * 4), 4, 4))
        .rejects.toThrow('RealESRGAN inference returned no output tensor.');
    });
  });
});
