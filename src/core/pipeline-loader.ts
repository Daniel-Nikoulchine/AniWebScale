import type { ExternalGlslModelDefinition } from '../shared/generated-external-glsl-models';
import { createGeneratedPipelineClass } from '../shared/generated-pipelines';
import { createExternalGlslPipelineClass } from './external-glsl-pipeline';
import { REALESRGAN_CLASS_TO_MODEL_FILE } from '../shared/realesrgan-models';
import { createRealEsrganPipelineClass } from './realesrgan-pipeline';
import { setupRealEsrganBrowserRuntime } from './realesrgan-browser-setup';
import { createRealEsrganSession } from './realesrgan-session';
import { RealEsrganWorkerClient, type RealEsrganInferenceRunner } from './realesrgan-worker-client';
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

function getRealEsrganWorkerRunner(): Promise<RealEsrganInferenceRunner | null> {
  if (!realEsrganWorkerClientPromise) {
    realEsrganWorkerClientPromise = RealEsrganWorkerClient.create();
  }
  return realEsrganWorkerClientPromise;
}

function realEsrganLoader(className: string): ConstructorLoader {
  return async () => {
    await setupRealEsrganBrowserRuntime();
    const session = await createRealEsrganSession(className);
    const runner = await getRealEsrganWorkerRunner();
    const worker: RealEsrganWorkerBinding | null = runner
      ? {
        runner,
        modelUrl: chrome.runtime.getURL(`models/realesrgan/${REALESRGAN_CLASS_TO_MODEL_FILE[className]}`),
      }
      : null;
    return createRealEsrganPipelineClass(session, undefined, worker);
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
