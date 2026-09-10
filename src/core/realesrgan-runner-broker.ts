/**
 * Runner broker for the RealESRGAN path: one module owns runner preference
 * order, health and retry. The pipeline loader asks for a runner; this
 * module decides native-first vs worker fallback, retries a missed native
 * handshake after a cooldown, and honors E2E-only overrides.
 *
 * Dependencies ride in through the constructor (storage reads, clock,
 * client factories), so tests drive the whole preference matrix without a
 * browser. Production wiring lives in `createProductionBroker()`.
 */
import { REALESRGAN_PIXELS_WASM_CHUNK } from '../shared/realesrgan-models';
import { E2E_KNOBS } from '../shared/realesrgan-e2e-knobs.js';
import { RealEsrganWorkerClient } from './realesrgan-worker-client';
import { RealEsrganNativeVulkanClient } from './realesrgan-native-vulkan-client';
import type { RealEsrganInferenceRunner } from './realesrgan-runner';

export type { RealEsrganInferenceRunner };

/**
 * Storage keys of the E2E runner overrides, derived from the canonical knob
 * table (realesrgan-e2e-knobs.js owns the names; the broker only reads them).
 */
function e2eStorageKey(env: string, fallback: string): string {
  return E2E_KNOBS.find(knob => knob.env === env)?.storage ?? fallback;
}
const E2E_FORCE_WORKER_STORAGE_KEY = e2eStorageKey('E2E_FORCE_WORKER', 'e2eForceWorker');
const E2E_VULKAN_SRVGG_STORAGE_KEY = e2eStorageKey('E2E_VULKAN_SRVGG', 'vulkanSrvgg');

export const NATIVE_RUNNER_RETRY_COOLDOWN_MS = 30_000;

/** Pure retry decision: retry a missed native runner after cooldown. */
export function shouldRetryNativeRunner(missAt: number, now: number): boolean {
  return missAt > 0 && now - missAt >= NATIVE_RUNNER_RETRY_COOLDOWN_MS;
}

export type RealEsrganNativeEngine = 'ncnn' | 'srvgg';

/** Injected primitives so tests drive the broker without a browser. */
export interface RealEsrganBrokerPrimitives {
  /** Read one storage key (null when storage is unavailable). */
  readStorageKey?: (key: string) => Promise<unknown>;
  /** Clock for the retry cooldown. */
  now?: () => number;
  /** Build a native runner for the engine (null when unavailable). */
  createNativeRunner?: (engine: RealEsrganNativeEngine) => Promise<RealEsrganInferenceRunner | null>;
  /** Build the worker runner (null when it cannot spawn). */
  createWorkerRunner?: (pixelsWasmPath: string) => Promise<RealEsrganInferenceRunner | null>;
}

async function readFlag(
  readStorageKey: ((key: string) => Promise<unknown>) | undefined,
  key: string,
): Promise<boolean> {
  if (!readStorageKey) return false;
  try {
    return (await readStorageKey(key)) === true;
  } catch {
    return false;
  }
}

export class RealEsrganRunnerBroker {
  private readonly readStorageKey?: (key: string) => Promise<unknown>;
  private readonly now: () => number;
  private readonly createNativeRunner: (engine: RealEsrganNativeEngine) => Promise<RealEsrganInferenceRunner | null>;
  private readonly createWorkerRunner: (pixelsWasmPath: string) => Promise<RealEsrganInferenceRunner | null>;
  private readonly e2eOverrides: boolean;
  private nativePromise: Promise<RealEsrganInferenceRunner | null> | null = null;
  private workerPromise: Promise<RealEsrganInferenceRunner | null> | null = null;
  private nativeMissAt = 0;

  constructor(primitives: RealEsrganBrokerPrimitives = {}, e2eOverrides?: boolean) {
    this.readStorageKey = primitives.readStorageKey;
    this.now = primitives.now ?? Date.now;
    this.createNativeRunner = primitives.createNativeRunner
      ?? ((engine) => RealEsrganNativeVulkanClient.create({ engine }));
    this.createWorkerRunner = primitives.createWorkerRunner
      // Depth 1 downstream (the pipeline sizes its frame jobs from
      // maxInFlight, which the worker adapter leaves absent = 1, because of
      // ORT's global output-buffer cache): client-side concurrency above 1
      // can never be used, so ask for 1 instead of the hardware-scaled
      // default.
      ?? ((pixelsWasmPath) => RealEsrganWorkerClient.create({ pixelsWasmPath, maxConcurrentRequests: 1 }));
    this.e2eOverrides = e2eOverrides
      ?? (typeof __ANIME4K_E2E__ !== 'undefined' && __ANIME4K_E2E__);
  }

  /**
   * Resolve one runner: native Vulkan first (Linux), then worker, then null
   * (the pipeline falls back to its main-thread session). Both runners are
   * cached singletons; a missed native handshake retries after a cooldown
   * instead of pinning the worker path forever.
   */
  async resolveRunner(): Promise<RealEsrganInferenceRunner | null> {
    // E2E override: the clip runner forces the worker path via storage to
    // gate worker-only behavior. Guarded so production never consults it.
    if (this.e2eOverrides && await readFlag(this.readStorageKey, E2E_FORCE_WORKER_STORAGE_KEY)) {
      return this.getWorkerRunner();
    }
    const native = await this.getNativeRunner();
    if (native) return native;
    return this.getWorkerRunner();
  }

  private getNativeRunner(): Promise<RealEsrganInferenceRunner | null> {
    // A dead-runner verdict parks the native path for the cooldown even
    // though nativePromise is null: without this gate the very next
    // resolveRunner() would re-create the adapter the guard just buried
    // (markRunnerDead nulls the cache but sets nativeMissAt, and the
    // !nativePromise branch below never consults the cooldown).
    if (this.nativePromise === null && this.nativeMissAt > 0
        && !shouldRetryNativeRunner(this.nativeMissAt, this.now())) {
      return Promise.resolve(null);
    }
    if (!this.nativePromise || shouldRetryNativeRunner(this.nativeMissAt, this.now())) {
      this.nativeMissAt = 0;
      this.nativePromise = (async () => {
        // Hand-written Vulkan SRVGG behind a storage opt-in (default off).
        // The host falls back to ncnn per frame when unavailable.
        const engine: RealEsrganNativeEngine = await readFlag(this.readStorageKey, E2E_VULKAN_SRVGG_STORAGE_KEY)
          ? 'srvgg'
          : 'ncnn';
        const runner = await this.createNativeRunner(engine);
        if (!runner) this.nativeMissAt = this.now();
        return runner;
      })();
    }
    return this.nativePromise;
  }

  private getWorkerRunner(): Promise<RealEsrganInferenceRunner | null> {
    if (!this.workerPromise) {
      // The worker lazily loads the WASM-SIMD compose module and falls
      // back to JS compose when it is missing or unloadable.
      const attempt = this.createWorkerRunner(REALESRGAN_PIXELS_WASM_CHUNK);
      // A failed spawn/init resolves null: do NOT pin it. Unlike the native
      // path (cooldown-parked miss) a dead worker cache would pin the
      // main-thread fallback forever — the next resolveRunner() (next video
      // build) retries the spawn instead. Rejections clear the cache too so
      // a throwing factory cannot wedge the broker.
      this.workerPromise = attempt.then(
        runner => {
          if (!runner) this.workerPromise = null;
          return runner;
        },
        error => {
          this.workerPromise = null;
          throw error;
        },
      );
    }
    return this.workerPromise;
  }

  /**
   * Drop a runner the Runner-Guard declared dead. The guard verdict is
   * global — runners are process-lifetime singletons shared across pipeline
   * instances — so the broker (the runner-health owner) forgets the cached
   * adapter and the next resolveRunner() re-runs the preference order: a
   * dead native runner falls through to the worker after its retry
   * cooldown, a dead worker respawns fresh.
   */
  markRunnerDead(deadRunner: RealEsrganInferenceRunner): Promise<void> {
    return (async () => {
      if (this.nativePromise && await this.nativePromise.then(r => r === deadRunner, () => false)) {
        this.nativePromise = null;
        // A native runner that died mid-stream still gets the cooldown: a
        // restart (or user fix) should not be hammered every rebuild.
        this.nativeMissAt = this.now();
      }
      if (this.workerPromise && await this.workerPromise.then(r => r === deadRunner, () => false)) {
        this.workerPromise = null;
      }
    })();
  }
}

/** Production broker: real clients, chrome storage, wall clock. */
export function createProductionBroker(): RealEsrganRunnerBroker {
  return new RealEsrganRunnerBroker({
    readStorageKey: async (key: string) => {
      const stored = await chrome.storage.local.get(key) as Record<string, unknown>;
      return stored[key];
    },
  });
}
