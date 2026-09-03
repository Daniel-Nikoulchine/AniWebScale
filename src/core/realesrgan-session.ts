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
import {
  realEsrganFp16ModelFileForClass,
  realEsrganInt8ModelFileForClass,
  realEsrganModelFileForClass,
} from '../shared/realesrgan-models';

const sessionCache = new Map<string, Promise<InferenceSession>>();

export type ModelUrlResolver = (fileName: string) => string;
export type ModelAssetExists = (fileName: string) => Promise<boolean>;

let resolveModelUrl: ModelUrlResolver | null = null;
let modelAssetExists: ModelAssetExists | null = null;

export interface RealEsrganExecutionConfig {
  /** Prefer FP16 WebGPU kernels when the adapter exposes shader-f16. */
  preferFloat16: boolean;
  /** Prefer INT8 quantized model (666K, ~1.8x faster, PSNR 32.5dB on anime). */
  preferInt8: boolean;
}

export interface RealEsrganThreadingConfig {
  /** Run the WASM backend inside a proxy worker (frees the main thread). */
  proxy: boolean;
  /** WASM thread count. >1 needs SharedArrayBuffer; the runtime may ignore it. */
  numThreads: number;
}

// Safe floor by default; the browser setup raises this before the first
// session is created.
let threadingConfig: RealEsrganThreadingConfig = { proxy: false, numThreads: 1 };
let executionConfig: RealEsrganExecutionConfig = { preferFloat16: false, preferInt8: false };

// Index into the cascade of the first level that produced a session. Later
// sessions start here instead of re-probing known-dead configurations.
let workingLevelIndex: number | null = null;

/**
 * Register how model file names are turned into fetchable URLs. The browser
 * path wires this to chrome.runtime.getURL; tests inject a file:// resolver.
 */
export function setRealEsrganModelUrlResolver(resolver: ModelUrlResolver): void {
  resolveModelUrl = resolver;
}

export function setRealEsrganModelAssetExists(checker: ModelAssetExists): void {
  modelAssetExists = checker;
}

/**
 * Register the preferred threading configuration. Call before the first
 * session is created; resets the persisted cascade level so the new
 * configuration is probed from the top.
 */
export function setRealEsrganThreadingConfig(config: RealEsrganThreadingConfig): void {
  threadingConfig = config;
  workingLevelIndex = null;
}

export function setRealEsrganExecutionConfig(config: RealEsrganExecutionConfig): void {
  executionConfig = config;
}

export function isRealEsrganFloat16Preferred(): boolean {
  return executionConfig.preferFloat16;
}

export function isRealEsrganInt8Preferred(): boolean {
  return executionConfig.preferInt8;
}

/**
 * Main-thread fallback sessions are shape-pinned: the model's symbolic dims
 * are fixed via `freeDimensionOverrides` (see the create call below for why),
 * so one session serves exactly one inference shape. The cache key carries
 * the shape and the pipeline requests the session for its active inference
 * size, which follows the RealESRGAN cap (effects-map `maxInferenceHeight`).
 */

interface CascadeLevel {
  proxy: boolean;
  numThreads: number;
  executionProviders: string[];
}

/**
 * Fastest-first fallback ladder. Each step loosens exactly one constraint:
 * 1. proxy worker + threads + WebGPU EP
 * 2. threads + WebGPU EP (proxy workers can be blocked in content scripts)
 * 3. threads, WASM only (WebGPU EP may reject the model's dynamic shapes)
 * 4. single-threaded WASM (no SharedArrayBuffer / worker spawning)
 * Duplicate levels collapse so a conservative config probes only once.
 */
function buildCascadeLevels(config: RealEsrganThreadingConfig): CascadeLevel[] {
  const webgpu = ['webgpu', 'wasm'];
  const wasmOnly = ['wasm'];
  const candidates: CascadeLevel[] = [
    { proxy: config.proxy, numThreads: config.numThreads, executionProviders: webgpu },
    { proxy: false, numThreads: config.numThreads, executionProviders: webgpu },
    { proxy: false, numThreads: 1, executionProviders: webgpu },
    { proxy: false, numThreads: config.numThreads, executionProviders: wasmOnly },
    { proxy: false, numThreads: 1, executionProviders: wasmOnly },
  ];
  const levels: CascadeLevel[] = [];
  for (const level of candidates) {
    const key = `${level.proxy}|${level.numThreads}|${level.executionProviders.join(',')}`;
    if (!levels.some(existing =>
      `${existing.proxy}|${existing.numThreads}|${existing.executionProviders.join(',')}` === key)) {
      levels.push(level);
    }
  }
  return levels;
}

export function createRealEsrganSession(className: string, width: number, height: number): Promise<InferenceSession> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return Promise.reject(new Error(`RealESRGAN session needs positive integer dims, got ${String(width)}x${String(height)}.`));
  }
  const cacheKey = `${className}_${width}x${height}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    if (!resolveModelUrl) {
      throw new Error('RealESRGAN model URL resolver is not registered.');
    }
    const fp32FileName = realEsrganModelFileForClass(className);
    const fp16FileName = realEsrganFp16ModelFileForClass(className);
    const int8FileName = realEsrganInt8ModelFileForClass(className);
    const useInt8 = executionConfig.preferInt8 && modelAssetExists
      ? await modelAssetExists(int8FileName)
      : false;
    const useFloat16 = !useInt8 && executionConfig.preferFloat16 && modelAssetExists
      ? await modelAssetExists(fp16FileName)
      : false;
    const fileName = useInt8 ? int8FileName : useFloat16 ? fp16FileName : fp32FileName;
    const modelUrl = resolveModelUrl(fileName);
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

    const levels = buildCascadeLevels(threadingConfig);
    const start = workingLevelIndex === null
      ? 0
      : Math.min(workingLevelIndex, levels.length - 1);
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
      ort.env.wasm.proxy = level.proxy;
      ort.env.wasm.numThreads = level.numThreads;
      console.log(
        '[RealESRGAN] try level %d: proxy=%s numThreads=%d EPs=%s',
        index, String(level.proxy), level.numThreads, level.executionProviders.join(','),
      );
      try {
        const session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: level.executionProviders,
          graphOptimizationLevel: 'all',
          // Pin the symbolic dims to THIS session's exact inference shape. The
          // pipeline downscales to maxInferenceHeight before readback, so the
          // shape varies with the active cap (e.g. 576x432 at cap 432,
          // 854x480 at cap 480); the session cache is keyed by shape, so each
          // size builds its own pinned session. ORT 1.29's
          // WebGPU EP throws "Shape mismatch attempting to re-use buffer
          // {1,480,640,3} != {1,1920,2560,3}" on the FIRST run of a model
          // with symbolic dims (batch_size/height/width): the output
          // buffer-reuse validator compares the NHWC input shape against the
          // output request. Concrete dims sidestep the symbolic-dim path.
          // Overrides for symbols a model does not declare are harmless
          // (verified against python ORT 1.29), so this is safe for both the
          // dynamic and the static-shape model.
          freeDimensionOverrides: {
            batch_size: 1,
            height,
            width,
          },
        });
        workingLevelIndex = index;
        console.log('[RealESRGAN] session created at level %d', index);
        return session;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[RealESRGAN] level %d failed: %s', index, message);
        // Once initWasm() has failed inside the runtime, every subsequent
        // Session.create with a different numThreads will throw the same
        // poisoned error. Stop cascading and surface the original cause.
        if (/previous call to 'initWasm\(\)' failed/i.test(message)) {
          console.error(
            '[RealESRGAN] initWasm() poisoned; remaining cascade levels skipped. ' +
            'Underlying cause was on level %d (see warning above).', index,
          );
          break;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('RealESRGAN session creation failed on every fallback level.');
  })();

  // A failed load must not poison the cache; drop it so a retry can re-attempt.
  void promise.catch(() => sessionCache.delete(cacheKey));
  sessionCache.set(cacheKey, promise);
  return promise;
}

/** Test hook: clear cached sessions and the persisted cascade level. */
export function clearRealEsrganSessionCache(): void {
  sessionCache.clear();
  workingLevelIndex = null;
}
