/**
 * ONNX session factory for the RealESRGAN inference path.
 *
 * Loads the bundled .onnx model for a given pipeline class and creates a
 * cached onnxruntime-web InferenceSession. Sessions are expensive to build
 * (graph optimisation + WASM warm-up), so one session per model variant is
 * created lazily and reused across pipeline rebuilds.
 *
 * The browser path prefers the WebGPU execution provider and falls back to
 * WASM. onnxruntime-web resolves its own .wasm binaries relative to
 * `env.wasm.wasmPaths`, which the caller must point at the extension's
 * bundled runtime before the first session is built.
 *
 * Models are handed to the runtime as URL strings, not byte buffers:
 * Firefox content scripts run in a separate compartment where even locally
 * constructed typed arrays fail the runtime's `instanceof Uint8Array` check
 * ("Unexpected argument[0]: must be 'path' or 'buffer'"). Passing the URL
 * lets onnxruntime-web fetch the bytes inside its own realm instead.
 *
 * Threading cascade: WASM inference is the bottleneck, so the factory tries
 * the fastest configuration first and loosens one constraint per failed
 * attempt: proxy worker off, then the WebGPU EP off, then multithreading
 * off. Worker spawning and SharedArrayBuffer availability differ between
 * browsers and content-script compartments; probing at session creation is
 * the only reliable way to find out what works. The first level that
 * succeeds is persisted so later model variants skip the dead steps.
 */
import type { InferenceSession } from 'onnxruntime-web';
import type { RealEsrganPrecision } from '../types';
import {
  realEsrganFp16ModelFileForClass,
  realEsrganInt8ModelFileForClass,
  realEsrganModelFileForClass,
  realEsrganStaticModelFileForShape,
} from '../shared/realesrgan-models';
import { formatRealEsrganError, REALESRGAN_ERROR_CODES, withRealEsrganCode } from '../shared/realesrgan-error-codes';
import { buildFreeDimensionOverrides } from '../shared/realesrgan-ort-shape-pinning.js';

export type ModelUrlResolver = (fileName: string) => string;
export type ModelAssetExists = (fileName: string) => Promise<boolean>;

export interface RealEsrganExecutionConfig {
  /** Prefer FP16 WebGPU kernels when the adapter exposes shader-f16. */
  preferFloat16: boolean;
  /** Prefer INT8 quantized model (666K, ~1.8x faster, PSNR 32.5dB on anime). */
  preferInt8: boolean;
}

export interface RealEsrganThreadingConfig {
  /** WASM thread count. >1 needs SharedArrayBuffer; the runtime may ignore it. */
  numThreads: number;
}

/**
 * Everything the session factory needs, handed in at CONSTRUCTION — the
 * former five module-level singletons and their setters. The temporal
 * invariant "configure before the first session" is now structural: no
 * factory, no session (the factory is built by
 * setupRealEsrganBrowserRuntime() and reaches the loader through it).
 */
export interface RealEsrganSessionConfig {
  resolveModelUrl: ModelUrlResolver;
  modelAssetExists?: ModelAssetExists;
  threading: RealEsrganThreadingConfig;
  execution: RealEsrganExecutionConfig;
}

/**
 * Main-thread fallback sessions are shape-pinned: the model's symbolic dims
 * are fixed via `freeDimensionOverrides` (see the create call below for why),
 * so one session serves exactly one inference shape. The cache key carries
 * the shape and the pipeline requests the session for its active inference
 * size, which follows the RealESRGAN cap (effects-map `maxInferenceHeight`).
 */

export interface CascadeLevel {
  numThreads: number;
  executionProviders: ReadonlyArray<'webgpu' | 'wasm'>;
}

/**
 * ORT-boundary classifier (the ONLY prose match on this path): the runtime
 * exposes its poisoned one-shot initWasm() state through message text alone,
 * so it is recognized here, once, and converted into control flow (stop
 * cascading). The failure itself is tagged SESSION_CREATE_FAILED downstream
 * — nothing else parses prose.
 */
function isInitWasmPoisoned(message: string): boolean {
  return /previous call to 'initWasm\(\)' failed/i.test(message);
}

/**
 * Fastest-first fallback ladder. Each step loosens exactly one constraint:
 * 1. threads + WebGPU EP
 * 2. single-threaded + WebGPU EP
 * 3. threads, WASM only (WebGPU EP may reject the model's dynamic shapes)
 * 4. single-threaded WASM (no SharedArrayBuffer)
 * The old proxy-worker lane is gone: it was permanently disabled by the
 * browser setup (a failed proxy spawn poisons ORT's one-shot initWasm()), so
 * keeping a live candidate for it only invited a configuration nobody can
 * request. Duplicate levels collapse so a conservative config probes once.
 */
export function buildCascadeLevels(numThreads: number): CascadeLevel[] {
  const webgpu: ReadonlyArray<'webgpu' | 'wasm'> = ['webgpu', 'wasm'];
  const wasmOnly: ReadonlyArray<'webgpu' | 'wasm'> = ['wasm'];
  const candidates: CascadeLevel[] = [
    { numThreads, executionProviders: webgpu },
    { numThreads: 1, executionProviders: webgpu },
    { numThreads, executionProviders: wasmOnly },
    { numThreads: 1, executionProviders: wasmOnly },
  ];
  const levels: CascadeLevel[] = [];
  for (const level of candidates) {
    const key = `${level.numThreads}|${level.executionProviders.join(',')}`;
    if (!levels.some(existing =>
      `${existing.numThreads}|${existing.executionProviders.join(',')}` === key)) {
      levels.push(level);
    }
  }
  return levels;
}

/**
 * The Session-Fallback factory: owns the shape-pinned session cache and the
 * persisted cascade level as instance state. The loader creates exactly one
 * through setupRealEsrganBrowserRuntime().
 */
export class RealEsrganSessionFactory {
  private readonly sessionCache = new Map<string, Promise<InferenceSession>>();
  // Index into the cascade of the first level that produced a session. Later
  // sessions start here instead of re-probing known-dead configurations.
  private workingLevelIndex: number | null = null;
  // Execution config chosen at construction; the pipeline reads it to label
  // phase stats (int8/fp32) and to gate the worker's fp16 probe.
  public readonly execution: RealEsrganExecutionConfig;

  constructor(private readonly config: RealEsrganSessionConfig) {
    this.execution = config.execution;
  }

  /**
   * Main-thread fallback session for one class, shape and precision.
   * `precision` defaults to the factory's construction-time execution config
   * so callers without a user setting (tests, E2E clip runner) keep the old
   * behaviour. The cache key carries the precision: int8/fp16/fp32 resolve
   * to different model files and must never share a session.
   */
  createSession(className: string, width: number, height: number, precision?: RealEsrganPrecision): Promise<InferenceSession> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return Promise.reject(new Error(`RealESRGAN session needs positive integer dims, got ${String(width)}x${String(height)}.`));
  }
  const effective: RealEsrganPrecision = precision
    ?? (this.config.execution.preferInt8 ? 'int8' : this.config.execution.preferFloat16 ? 'fp16' : 'fp32');
  const cacheKey = `${className}_${width}x${height}_${effective}`;
  const cached = this.sessionCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const fp32FileName = realEsrganModelFileForClass(className);
    const fp16FileName = realEsrganFp16ModelFileForClass(className);
    const int8FileName = realEsrganInt8ModelFileForClass(className);
    const assetExists = this.config.modelAssetExists;
    const useInt8 = effective === 'int8' && assetExists
      ? await assetExists(int8FileName)
      : false;
    const useFloat16 = !useInt8 && effective === 'fp16' && assetExists
      ? await assetExists(fp16FileName)
      : false;
    let fileName = useInt8 ? int8FileName : useFloat16 ? fp16FileName : fp32FileName;
    // Hebel 2.1: exact-shape static fp32 variant when the ladder settled on
    // the dynamic fp32 file. Static never overrides an int8/fp16 pick, and
    // only when the packaged asset exists — absence falls back silently.
    // freeDimensionOverrides stay uniform (harmless on static models): zero
    // runtime cost, one code path.
    if (fileName === fp32FileName && assetExists) {
      const staticFile = realEsrganStaticModelFileForShape(width, height);
      if (staticFile && await assetExists(staticFile)) fileName = staticFile;
    }
    const modelUrl = this.config.resolveModelUrl(fileName);
    const ort = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');

    // Diagnostics: capture the runtime environment so the cascade log tells
    // us *why* a level failed (e.g. no SharedArrayBuffer on Zen/FF without
    // crossOriginIsolation, which forces single-threaded WASM and disables
    // the jsep WebGPU path).
    const crossOriginIsolated = (globalThis as { crossOriginIsolated?: boolean })
      .crossOriginIsolated === true;
    const sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    console.log(
      '[RealESRGAN] session create: model=%s crossOriginIsolated=%s sharedArrayBuffer=%s',
      fileName, crossOriginIsolated, sharedArrayBuffer,
    );

    const levels = buildCascadeLevels(this.config.threading.numThreads);
    const start = this.workingLevelIndex === null
      ? 0
      : Math.min(this.workingLevelIndex, levels.length - 1);
    let lastError: unknown = null;
    for (let index = start; index < levels.length; index += 1) {
      const level = levels[index];
      // Skip levels that the environment cannot satisfy at all. Doing this
      // BEFORE the first Session.create avoids poisoning onnxruntime-web's
      // global initWasm() state with a configuration we know is dead.
      if (level.numThreads > 1 && !sharedArrayBuffer) {
        console.warn(
          '[RealESRGAN] skip level %d (numThreads=%d): SharedArrayBuffer unavailable',
          index, level.numThreads,
        );
        continue;
      }
      ort.env.wasm.numThreads = level.numThreads;
      console.log(
        '[RealESRGAN] try level %d: numThreads=%d EPs=%s',
        index, level.numThreads, level.executionProviders.join(','),
      );
      try {
        const freeDimensionOverrides = buildFreeDimensionOverrides({
          batchSize: 1,
          height,
          width,
          outHeight: height * 4,
          outWidth: width * 4,
        });
        const session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: level.executionProviders,
          graphOptimizationLevel: 'all',
          // Shape pinning: same rationale as the worker (see
          // realesrgan-ort-shape-pinning.js — the single implementation of
          // the ORT output-buffer workaround, out_* pinned defensively).
          // The pipeline downscales to maxInferenceHeight before readback,
          // so the shape varies with the active cap (e.g. 576x432 at cap
          // 432, 854x480 at cap 480); the session cache is keyed by shape,
          // so each size builds its own pinned session.
          freeDimensionOverrides,
        });
        this.workingLevelIndex = index;
        console.log('[RealESRGAN] session created at level %d', index);
        return session;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[RealESRGAN] level %d failed: %s', index, message);
        // Once initWasm() has failed inside the runtime, every subsequent
        // Session.create with a different numThreads will throw the same
        // poisoned error. Stop cascading and surface the original cause.
        if (isInitWasmPoisoned(message)) {
          // Coded so the E2E gate detects the poison by code, not prose.
          console.error(
            formatRealEsrganError(REALESRGAN_ERROR_CODES.SESSION_CREATE_FAILED,
              `initWasm() poisoned on cascade level ${index}; remaining levels skipped ` +
              '(see the warning above for the underlying cause).'),
          );
          break;
        }
      }
    }
    // Coded + prefixed: the drain logs the rejection, and the E2E gate counts
    // the fatal code instead of matching prose.
    const finalMessage = lastError instanceof Error
      ? lastError.message
      : 'RealESRGAN session creation failed on every fallback level.';
    throw withRealEsrganCode(
      new Error(formatRealEsrganError(REALESRGAN_ERROR_CODES.SESSION_CREATE_FAILED, finalMessage)),
      REALESRGAN_ERROR_CODES.SESSION_CREATE_FAILED,
    );
  })();

  // A failed load must not poison the cache; drop it so a retry can re-attempt.
  void promise.catch(() => this.sessionCache.delete(cacheKey));
  this.sessionCache.set(cacheKey, promise);
  return promise;
  }
}
