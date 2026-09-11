import { createGeneratedPipelineClass } from '../shared/generated-pipelines';
import { REALESRGAN_CLASS_TO_MODEL_FILE } from '../shared/realesrgan-models';
import { createRealEsrganPipelineClass } from './realesrgan-pipeline';
import { setupRealEsrganBrowserRuntime } from './realesrgan-browser-setup';
import { createProductionBroker, type RealEsrganInferenceRunner } from './realesrgan-runner-broker';
import { loadRealEsrganModelAssets, type RealEsrganModelAssets } from './realesrgan-model-assets';
import type { RealEsrganRunnerBinding } from './realesrgan-pipeline';
import type { GeneratedKernelSet, PipelineConstructor } from './pipeline-types';
import type { InferenceSession } from 'onnxruntime-web';

type ModuleLoader = () => Promise<Record<string, unknown>>;
type ConstructorLoader = () => Promise<PipelineConstructor>;

const vendorLoaders: Record<string, ModuleLoader> = {
  ClampHighlights: () => import(
    /* webpackChunkName: "anime4k-common" */ 'anime4k-webgpu/common'
  ),
  CNNM: () => import(/* webpackChunkName: "anime4k-quality-m" */ 'anime4k-webgpu/quality-m'),
  CNNSoftM: () => import(/* webpackChunkName: "anime4k-quality-m" */ 'anime4k-webgpu/quality-m'),
  CNNx2M: () => import(/* webpackChunkName: "anime4k-quality-m" */ 'anime4k-webgpu/quality-m'),
  CNNVL: () => import(/* webpackChunkName: "anime4k-quality-vl" */ 'anime4k-webgpu/quality-vl'),
  CNNSoftVL: () => import(/* webpackChunkName: "anime4k-quality-vl" */ 'anime4k-webgpu/quality-vl'),
  CNNx2VL: () => import(/* webpackChunkName: "anime4k-quality-vl" */ 'anime4k-webgpu/quality-vl'),
  DenoiseCNNx2VL: () => import(
    /* webpackChunkName: "anime4k-quality-vl" */ 'anime4k-webgpu/quality-vl'
  ),
  CNNUL: () => import(/* webpackChunkName: "anime4k-quality-ul" */ 'anime4k-webgpu/quality-ul'),
  CNNx2UL: () => import(/* webpackChunkName: "anime4k-quality-ul" */ 'anime4k-webgpu/quality-ul'),
};

function generatedLoader(
  className: 'CNNSoftUL' | 'DenoiseCNNx2M' | 'DenoiseCNNx2UL',
  loadModel: () => Promise<{ default: GeneratedKernelSet }>,
): ConstructorLoader {
  return async () => createGeneratedPipelineClass(className, (await loadModel()).default);
}

const localLoaders: Record<string, ConstructorLoader> = {
  CNNSoftUL: generatedLoader('CNNSoftUL', () => import(
    /* webpackChunkName: "model-cnn-soft-ul" */ 'anime4k-model/cnn-soft-ul'
  )),
  DenoiseCNNx2M: generatedLoader('DenoiseCNNx2M', () => import(
    /* webpackChunkName: "model-denoise-cnn-x2-m" */ 'anime4k-model/denoise-cnn-x2-m'
  )),
  DenoiseCNNx2UL: generatedLoader('DenoiseCNNx2UL', () => import(
    /* webpackChunkName: "model-denoise-cnn-x2-ul" */ 'anime4k-model/denoise-cnn-x2-ul'
  )),
};

/**
 * Injectable state for the loader. The default instance keeps the historical
 * process-lifetime singletons (one broker, one asset cache, one constructor
 * cache); tests can pass fresh instances to isolate themselves instead of
 * sharing module state.
 */
export interface PipelineLoaderDeps {
  /** Runner broker: caches adapters and owns runner health. */
  broker: ReturnType<typeof createProductionBroker>;
  /** Modell-Auswahl per class (the static-shape HEAD-verify is network I/O). */
  modelAssetsCache: Map<string, Promise<RealEsrganModelAssets>>;
  /** Non-RealESRGAN pipeline constructors loaded once. */
  constructorCache: Map<string, PipelineConstructor>;
  /** Session-fallback runtime setup (ORT/WASM), injectable for tests. */
  setupRuntime: typeof setupRealEsrganBrowserRuntime;
}

export type PipelineLoader = (className: string) => Promise<PipelineConstructor | null>;

/**
 * Build a pipeline loader over explicit dependencies. The module-level
 * `loadPipelineConstructor` is one such loader over the default singletons;
 * keeping the singletons behind this factory means a test can construct an
 * isolated loader without reaching into module state, and a future caller
 * could scope a loader per document.
 */
export function createPipelineLoader(overrides: Partial<PipelineLoaderDeps> = {}): PipelineLoader {
  // One broker serves every RealESRGAN variant: runners are cached inside,
  // so a second pipeline build reuses the healthy runner instead of spawning
  // redundant workers or re-handshaking the host. The broker also owns runner
  // health: a Runner-Guard "dead" verdict escalates through markRunnerDead.
  const broker = overrides.broker ?? createProductionBroker();
  // Modell-Auswahl is loaded once per class, while the runner is re-resolved
  // per pipeline CONSTRUCTION — a Runner-Guard death verdict drops the broker
  // cache, and the next video build must re-run the preference order instead
  // of re-binding the buried runner from a frozen closure.
  const modelAssetsCache = overrides.modelAssetsCache ?? new Map<string, Promise<RealEsrganModelAssets>>();
  const constructorCache = overrides.constructorCache ?? new Map<string, PipelineConstructor>();
  const setupRuntime = overrides.setupRuntime ?? setupRealEsrganBrowserRuntime;

  function realEsrganLoader(className: string): ConstructorLoader {
    return async () => {
      // Degrade stage by stage instead of throwing: a pipeline with no
      // runner still primes the canvas (bilinear) and rides the fatal
      // fallback chain, and a runnerless pipeline WITH a session factory
      // serves frames from the main-thread session. Only a total failure
      // (no factory either) leaves prime-then-fallback — still better than
      // a rejected constructor that kills enhancement outright.
      let sessionFactory: Awaited<ReturnType<typeof setupRealEsrganBrowserRuntime>> | null = null;
      try {
        // The Session-Fallback factory carries the config, cache and cascade
        // level; one instance serves every class and shape for this lifetime.
        sessionFactory = await setupRuntime();
      } catch (error) {
        console.warn('[RealESRGAN] browser runtime setup failed; pipeline degrades to prime + fallback chain', error);
      }
      let assets: RealEsrganModelAssets | null = null;
      if (sessionFactory) {
        try {
          let modelAssets = modelAssetsCache.get(className);
          if (!modelAssets) {
            modelAssets = loadRealEsrganModelAssets(className, {
              resolveUrl: path => chrome.runtime.getURL(path),
              readStorageKey: async (key: string) => {
                const stored = await chrome.storage.local.get(key) as Record<string, unknown>;
                return stored[key];
              },
            });
            // A failed load must not poison the cache (mirrors the session cache
            // behaviour): evict it so the next construction re-attempts.
            void modelAssets.catch(() => modelAssetsCache.delete(className));
            modelAssetsCache.set(className, modelAssets);
          }
          assets = await modelAssets;
        } catch (error) {
          console.warn('[RealESRGAN] model assets unavailable; pipeline degrades to the session path', error);
        }
      }
      // Try native Vulkan first (Linux), then worker, then main-thread.
      // The native host is persistent and ~10x faster than WASM on NAVI22,
      // so paying its 4s handshake once is worth it. resolveRunner() is cheap
      // here: the broker caches its adapters and re-resolves only after a
      // markRunnerDead escalation or the native retry cooldown.
      let runner: RealEsrganInferenceRunner | null = null;
      if (assets) {
        try {
          runner = await broker.resolveRunner();
        } catch (error) {
          console.warn('[RealESRGAN] runner resolution failed; pipeline degrades to the session path', error);
        }
      }
      const binding: RealEsrganRunnerBinding | null = runner && assets
        ? {
          runner,
          modelAssets: assets,
          onRunnerDead: dead => broker.markRunnerDead(dead),
        }
        : null;
      // Worker-death recovery: if the worker dies MID-STREAM, the pipeline's
      // runner is nulled and it needs a main-thread session that did not exist
      // at load time. The session factory caches per class, shape and model
      // variant, so the first frame at a new size pays the session cost and
      // every later frame at that size reuses it. The model variant (int8 on
      // the WASM fallback, else fp32) is auto-selected by the factory's
      // execution config — no user setting.
      const getSession = sessionFactory
        ? (width: number, height: number): Promise<InferenceSession> =>
          sessionFactory.createSession(className, width, height)
        : null;
      return createRealEsrganPipelineClass(binding, getSession, sessionFactory?.execution ?? null);
    };
  }

  const realEsrganLoaders: Record<string, ConstructorLoader> = Object.fromEntries(
    Object.keys(REALESRGAN_CLASS_TO_MODEL_FILE).map(className => [className, realEsrganLoader(className)]),
  );

  return async function loadPipelineConstructor(className: string): Promise<PipelineConstructor | null> {
    // RealESRGAN classes are NOT cached as constructed classes: the binding
    // must re-resolve its runner per construction so a Runner-Guard death
    // verdict (escalated via markRunnerDead) takes effect for every following
    // build. Modell-Auswahl and the broker's adapter promises carry the real
    // cost and are cached on their own.
    const realEsrganLoader = realEsrganLoaders[className];
    if (realEsrganLoader) return realEsrganLoader();

    const cached = constructorCache.get(className);
    if (cached) return cached;

    const localLoader = localLoaders[className];
    const Constructor = localLoader
      ? await localLoader()
      : await loadVendorConstructor(className);
    if (Constructor) constructorCache.set(className, Constructor);
    return Constructor;
  };
}

/**
 * The process-lifetime loader used by the renderer. Default exports keep the
 * historical singleton behaviour unchanged.
 */
export const loadPipelineConstructor: PipelineLoader = createPipelineLoader();

async function loadVendorConstructor(className: string): Promise<PipelineConstructor | null> {
  const loadModule = vendorLoaders[className];
  if (!loadModule) return null;
  const module = await loadModule();
  return module[className] as PipelineConstructor | undefined ?? null;
}
