import type { ExternalGlslModelDefinition } from '../shared/generated-external-glsl-models';
import { createGeneratedPipelineClass } from '../shared/generated-pipelines';
import { createExternalGlslPipelineClass } from './external-glsl-pipeline';
import { REALESRGAN_CLASS_TO_MODEL_FILE } from '../shared/realesrgan-models';
import { createRealEsrganPipelineClass } from './realesrgan-pipeline';
import { setupRealEsrganBrowserRuntime } from './realesrgan-browser-setup';
import { createRealEsrganSession } from './realesrgan-session';
import { RealEsrganWorkerClient, type RealEsrganInferenceRunner } from './realesrgan-worker-client';
import { RealEsrganNativeVulkanClient } from './realesrgan-native-vulkan-client';
import type { RealEsrganWorkerBinding } from './realesrgan-pipeline';
import type { GeneratedKernelSet, PipelineConstructor } from './pipeline-types';

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

function externalLoader(
  loadModel: () => Promise<{ default: unknown }>,
): ConstructorLoader {
  return async () => createExternalGlslPipelineClass(
    (await loadModel()).default as ExternalGlslModelDefinition,
  );
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
  ArtCNNX2: externalLoader(() => import(
    /* webpackChunkName: "model-artcnn-x2" */ 'anime4k-model/artcnn-x2'
  )),
  ACNetX2: externalLoader(() => import(
    /* webpackChunkName: "model-acnet-x2" */ 'anime4k-model/acnet-x2'
  )),
  ARNetX2: externalLoader(() => import(
    /* webpackChunkName: "model-arnet-x2" */ 'anime4k-model/arnet-x2'
  )),
};

// One worker serves every RealESRGAN variant: the worker caches ORT sessions
// per model URL, so spawning a second client per class would only add a
// redundant worker. The promise is shared; a failed spawn resolves to null
// and the pipeline falls back to the main-thread session.
let realEsrganWorkerClientPromise: Promise<RealEsrganInferenceRunner | null> | null = null;
// Native Vulkan host is tried first on Linux (REBAR+RADV 14ms vs WASM 70ms).
// Also a shared singleton; a missing host or Vulkan init failure resolves to
// null and the pipeline falls through to the worker path.
let realEsrganNativeClientPromise: Promise<RealEsrganInferenceRunner | null> | null = null;

function getRealEsrganNativeRunner(): Promise<RealEsrganInferenceRunner | null> {
  if (!realEsrganNativeClientPromise) {
    realEsrganNativeClientPromise = RealEsrganNativeVulkanClient.create();
  }
  return realEsrganNativeClientPromise;
}

function getRealEsrganWorkerRunner(): Promise<RealEsrganInferenceRunner | null> {
  if (!realEsrganWorkerClientPromise) {
    realEsrganWorkerClientPromise = RealEsrganWorkerClient.create();
  }
  return realEsrganWorkerClientPromise;
}

function realEsrganLoader(className: string): ConstructorLoader {
  return async () => {
    await setupRealEsrganBrowserRuntime();
    // Try native Vulkan first (Linux), then worker, then main-thread.
    // The native host is persistent and ~10x faster than WASM on NAVI22,
    // so paying its 4s handshake once is worth it.
    let runner: RealEsrganInferenceRunner | null = await getRealEsrganNativeRunner();
    if (!runner) {
      runner = await getRealEsrganWorkerRunner();
    }
    // No eager main-thread session here: sessions are shape-pinned (one per
    // inference size) and the inference size is only known once the pipeline
    // is constructed for a source. The pipeline warms its size via getSession
    // in its constructor, and the drain path awaits the same cached promise.
    // E2E override: the clip runner can point the pipeline at a
    // static-shape model variant via storage. Guarded by the E2E flag so
    // production builds never consult storage for model URLs.
    let modelFileOverride: string | null = null;
    if (__ANIME4K_E2E__) {
      try {
        const stored = await chrome.storage.local.get('e2eModelFile');
        if (typeof stored.e2eModelFile === 'string') modelFileOverride = stored.e2eModelFile;
      } catch { /* storage unavailable */ }
    }
    // Both model URLs are resolved here because the worker has no chrome.*
    // APIs. The worker prefers the FP16 asset and falls back to the FP32
    // file when the session cascade fails or the asset is missing. FP16 is
    // currently dead on RDNA2 (ORT 1.29 WebGPU EP emits invalid f16 WGSL for
    // the Clip kernel), so getSession()'s fp16 attempt fails and the fp32
    // attempt below is what actually serves frames.
    const worker: RealEsrganWorkerBinding | null = runner
      ? {
        runner,
        modelUrl: chrome.runtime.getURL(`models/realesrgan/${modelFileOverride ?? REALESRGAN_CLASS_TO_MODEL_FILE[className]}`),
        // FP16 disabled: ORT-web 1.29's WebGPU EP compiles an invalid WGSL
        // Clip kernel for the fp16 graph on RDNA2 ("ShaderModule with 'Clip'
        // label is invalid"), so handing the worker the fp16 URL only burns
        // a session attempt + a timed-out frame before the fp32 attempt.
        // Pass null to skip the fp16 probe until the EP ships valid kernels.
        modelUrlFp16: null,
      }
      : null;
    // Worker-death recovery: if the worker dies MID-STREAM, the pipeline's
    // runner is nulled and it needs a main-thread session that did not exist
    // at load time. createRealEsrganSession() caches per class AND shape, so
    // the first frame at a new size pays the session cost and every later
    // frame at that size reuses it.
    const getSession = (width: number, height: number) => createRealEsrganSession(className, width, height);
    return createRealEsrganPipelineClass(null, undefined, worker, getSession);
  };
}

const realEsrganLoaders: Record<string, ConstructorLoader> = Object.fromEntries(
  Object.keys(REALESRGAN_CLASS_TO_MODEL_FILE).map(className => [className, realEsrganLoader(className)]),
);

const constructorCache = new Map<string, PipelineConstructor>();

export async function loadPipelineConstructor(className: string): Promise<PipelineConstructor | null> {
  const cached = constructorCache.get(className);
  if (cached) return cached;

  const localLoader = localLoaders[className]
    ?? realEsrganLoaders[className];
  const Constructor = localLoader
    ? await localLoader()
    : await loadVendorConstructor(className);
  if (Constructor) constructorCache.set(className, Constructor);
  return Constructor;
}

async function loadVendorConstructor(className: string): Promise<PipelineConstructor | null> {
  const loadModule = vendorLoaders[className];
  if (!loadModule) return null;
  const module = await loadModule();
  return module[className] as PipelineConstructor | undefined ?? null;
}
