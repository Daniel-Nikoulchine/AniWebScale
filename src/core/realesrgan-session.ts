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
import { realEsrganModelFileForClass } from '../shared/realesrgan-models';

const sessionCache = new Map<string, Promise<InferenceSession>>();

export type ModelUrlResolver = (fileName: string) => string;

let resolveModelUrl: ModelUrlResolver | null = null;

export interface RealEsrganThreadingConfig {
  /** Run the WASM backend inside a proxy worker (frees the main thread). */
  proxy: boolean;
  /** WASM thread count. >1 needs SharedArrayBuffer; the runtime may ignore it. */
  numThreads: number;
}

// Safe floor by default; the browser setup raises this before the first
// session is created.
let threadingConfig: RealEsrganThreadingConfig = { proxy: false, numThreads: 1 };

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

/**
 * Register the preferred threading configuration. Call before the first
 * session is created; resets the persisted cascade level so the new
 * configuration is probed from the top.
 */
export function setRealEsrganThreadingConfig(config: RealEsrganThreadingConfig): void {
  threadingConfig = config;
  workingLevelIndex = null;
}

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

export function createRealEsrganSession(className: string): Promise<InferenceSession> {
  const cached = sessionCache.get(className);
  if (cached) return cached;

  const promise = (async () => {
    if (!resolveModelUrl) {
      throw new Error('RealESRGAN model URL resolver is not registered.');
    }
    const fileName = realEsrganModelFileForClass(className);
    const modelUrl = resolveModelUrl(fileName);
    const ort = await import(/* webpackChunkName: "ort" */ 'onnxruntime-web');

    const levels = buildCascadeLevels(threadingConfig);
    const start = workingLevelIndex === null
      ? 0
      : Math.min(workingLevelIndex, levels.length - 1);
    let lastError: unknown = null;
    for (let index = start; index < levels.length; index += 1) {
      const level = levels[index];
      ort.env.wasm.proxy = level.proxy;
      ort.env.wasm.numThreads = level.numThreads;
      try {
        const session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: level.executionProviders,
        });
        workingLevelIndex = index;
        return session;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('RealESRGAN session creation failed on every fallback level.');
  })();

  // A failed load must not poison the cache; drop it so a retry can re-attempt.
  void promise.catch(() => sessionCache.delete(className));
  sessionCache.set(className, promise);
  return promise;
}

/** Test hook: clear cached sessions and the persisted cascade level. */
export function clearRealEsrganSessionCache(): void {
  sessionCache.clear();
  workingLevelIndex = null;
}
