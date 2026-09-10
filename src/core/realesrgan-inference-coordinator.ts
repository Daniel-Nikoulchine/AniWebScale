/**
 * Inference orchestration for the RealESRGAN pipeline: the runner wrappers,
 * the per-shape main-thread fallback session cache, the build/run timeouts
 * and the lazy ORT Tensor import.
 *
 * Extracted from `realesrgan-pipeline.ts` so the "how a frame is inferred"
 * machinery lives in one place. The pipeline stays the owner of the runner
 * identity (the Runner-Guard and the transport-downscale wiring need it) and
 * the failover policy; it reaches this module through the narrow
 * `RealEsrganInferenceHost` seam (runner accessor + guard + full-shape
 * dimensions). The fallback session map is the one piece of state that moves
 * here: it is keyed by the shape actually inferred (tiles/crops infer at
 * their own size) and has no other reader.
 */
import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { withRealEsrganCode, REALESRGAN_ERROR_CODES } from '../shared/realesrgan-error-codes';
import type { RealEsrganFrameResult, RealEsrganInferenceRunner } from './realesrgan-runner';

/** A hung fallback build must not poison the per-shape memo forever. */
const SESSION_CREATE_TIMEOUT_MS = 30_000;
/** A wedged fallback session run must not park the frame loop forever. */
const SESSION_RUN_TIMEOUT_MS = 30_000;

type OrtTensorConstructor = typeof import('onnxruntime-web')['Tensor'];

/**
 * Module-level lazy ORT import: every pipeline instance in the process shares
 * one import Promise instead of re-triggering the dynamic import (and its
 * bundler chunk lookup) on every tile of every session frame. The promise is
 * created once on first use; a rejected import clears it so a transient
 * bundler/fetch failure can be retried.
 */
let ortTensorPromise: Promise<OrtTensorConstructor> | null = null;

function loadOrtTensor(): Promise<OrtTensorConstructor> {
  ortTensorPromise ??= import(/* webpackChunkName: "ort" */ 'onnxruntime-web').then(
    module => module.Tensor,
    error => {
      ortTensorPromise = null;
      throw error;
    },
  );
  return ortTensorPromise;
}

/**
 * What the coordinator needs from the owning pipeline. `getRunner` is a
 * read-through accessor (the pipeline nulls its runner on a guard verdict);
 * `guardInference` applies the Runner-Guard policy to one runner call. The
 * full-shape dimensions key the warmup handle (tiles/crops ask for their own
 * shape explicitly through ensureFallbackSessionFor).
 */
export interface RealEsrganInferenceHost {
  getRunner(): RealEsrganInferenceRunner | null;
  guardInference<T>(task: () => Promise<T>): Promise<T>;
  readonly inferenceWidth: number;
  readonly inferenceHeight: number;
}

export class RealEsrganInferenceCoordinator {
  // Fallback session is per-pipeline state, memoized as ONE promise so the
  // constructor warmup, the guard's warmFallback and the drain's lazy path
  // share a single handle (a rejected build resets it so the next frame
  // retries). It must not live in the factory closure: the loader builds the
  // class once per construction and shares it across videos, so a second
  // video's warmup would overwrite the first video's session.
  private readonly fallbackSessionPromises = new Map<string, Promise<InferenceSession>>();

  constructor(
    private readonly host: RealEsrganInferenceHost,
    private readonly getSession: ((width: number, height: number) => Promise<InferenceSession>) | null,
  ) {}

  /**
   * Per-shape memo for the main-thread fallback session: constructor
   * warmup, guard warmFallback and the drain's lazy path all await it. A
   * rejected build drops its key so the next frame retries (the session
   * factory drops its own failed cache entries too). Sessions are
   * shape-pinned (buildFreeDimensionOverrides), so a letterbox crop
   * infers at crop size and needs its own session — the factory caches
   * per shape, and crop geometries are few (hysteretic letterbox), so
   * each distinct shape pays the build cost once.
   */
  ensureFallbackSessionFor(width: number, height: number): Promise<InferenceSession> {
    if (!this.getSession) {
      return Promise.reject(new Error('RealESRGAN main-thread fallback session is unavailable.'));
    }
    const key = `${width}x${height}`;
    let promise = this.fallbackSessionPromises.get(key);
    if (!promise) {
      promise = this.getSession(width, height).catch(error => {
        this.fallbackSessionPromises.delete(key);
        throw error;
      });
      this.fallbackSessionPromises.set(key, promise);
    }
    return promise;
  }

  /** Full-shape handle for warmup and the guard's fallback warm. */
  ensureFallbackSession(): Promise<InferenceSession> {
    return this.ensureFallbackSessionFor(this.host.inferenceWidth, this.host.inferenceHeight);
  }

  async runWorkerInference(
    modelUrl: string,
    modelUrlFp16: string | null,
    inputRgb: Float32Array,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
  ): Promise<RealEsrganFrameResult> {
    const runner = this.host.getRunner();
    if (!runner) {
      throw new Error('RealESRGAN runner binding is unavailable.');
    }
    return this.host.guardInference(() => runner.runFrame(
      modelUrl, modelUrlFp16, width, height, inputRgb,
      targetWidth, targetHeight,
    ));
  }

  /**
   * Native fast path: tight RGBA8 straight to a runner that accepts it
   * (see RealEsrganInferenceRunner.runFrameRgba). Same timeout/fallback
   * accounting as runWorkerInference via the shared guard. Width/height
   * are the content-crop dims when Hebel 1.1 is active, else full-frame.
   */
  async runNativeRgbaFrame(
    modelUrl: string,
    rgba: Uint8Array,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
  ): Promise<RealEsrganFrameResult> {
    const runner = this.host.getRunner();
    if (!runner || typeof runner.runFrameRgba !== 'function') {
      throw new Error('RealESRGAN RGBA runner binding is unavailable.');
    }
    return this.host.guardInference(() => runner.runFrameRgba!(
      modelUrl, width, height, rgba,
      targetWidth, targetHeight,
    ));
  }

  async runSessionInference(tileRgb: Float32Array, tileWidth: number, tileHeight: number): Promise<Float32Array> {
    // Tiles (and cropped frames) run at their own size; the full-frame
    // session would reject the input shape. The per-shape memo keeps each
    // distinct geometry at one build cost.
    let fallback: InferenceSession;
    try {
      fallback = await Promise.race([
        this.ensureFallbackSessionFor(tileWidth, tileHeight),
        new Promise<never>((_, reject) => setTimeout(() => reject(withRealEsrganCode(
          new Error(`RealESRGAN fallback session build timed out after ${SESSION_CREATE_TIMEOUT_MS}ms`),
          REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
        )), SESSION_CREATE_TIMEOUT_MS)),
      ]);
    } catch (error) {
      // A hung build must not poison the memo: drop the key so the next
      // frame rebuilds instead of awaiting the same stuck promise forever.
      this.fallbackSessionPromises.delete(`${tileWidth}x${tileHeight}`);
      throw error;
    }
    const OrtTensor = await loadOrtTensor();
    const inputName = fallback.inputNames[0] ?? 'input';
    const outputName = fallback.outputNames[0] ?? 'output';
    // FP16 model when registered and preferred; the FP32 model stays the
    // quality reference. Both models expose float32 I/O.
    const input = new OrtTensor('float32', tileRgb, [1, 3, tileHeight, tileWidth]);
    const outputs = await Promise.race([
      fallback.run({ [inputName]: input as Tensor }),
      new Promise<never>((_, reject) => setTimeout(() => reject(withRealEsrganCode(
        new Error(`RealESRGAN session run timed out after ${SESSION_RUN_TIMEOUT_MS}ms`),
        REALESRGAN_ERROR_CODES.PIPELINE_INFER_RETRY,
      )), SESSION_RUN_TIMEOUT_MS)),
    ]);
    const result = outputs[outputName];
    if (!result) throw new Error('RealESRGAN inference returned no output tensor.');
    return result.data as Float32Array;
  }
}
