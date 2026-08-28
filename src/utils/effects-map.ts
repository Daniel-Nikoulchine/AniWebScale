import type { AiUpscaleMode, EnhancementEffect, QualityTier } from '../types';

const restore = (quality: QualityTier): EnhancementEffect => ({
  id: `anime4k/Restore/CNN${quality}`,
  name: `Restore CNN (${quality})`,
  className: `CNN${quality}`,
});

const restoreSoft = (quality: QualityTier): EnhancementEffect => ({
  id: `anime4k/Restore/CNNSoft${quality}`,
  name: `Restore CNN Soft (${quality})`,
  className: `CNNSoft${quality}`,
  webgpuAvailable: true,
});

const upscale = (quality: QualityTier): EnhancementEffect => ({
  id: `anime4k/Upscale/CNNx2${quality}`,
  name: `Upscale CNN x2 (${quality})`,
  className: `CNNx2${quality}`,
  upscaleFactor: 2,
});

const denoiseUpscale = (quality: QualityTier): EnhancementEffect => ({
  id: `anime4k/Upscale/DenoiseCNNx2${quality}`,
  name: `Upscale and denoise CNN x2 (${quality})`,
  className: `DenoiseCNNx2${quality}`,
  upscaleFactor: 2,
  webgpuAvailable: true,
});

/**
 * Complete official effect catalogue used by the 6 x 3 preset matrix.
 * The three classes absent from anime4k-webgpu 1.0.0 are provided by generated
 * local pipelines, so every entry in the matrix is an exact quality variant.
 */
const AVAILABLE_EFFECTS: EnhancementEffect[] = [
  {
    id: 'anime4k/Helper/ClampHighlights',
    name: 'Clamp Highlights',
    className: 'ClampHighlights',
  },
  ...(['M', 'VL', 'UL'] as const).flatMap(quality => [
    restore(quality),
    restoreSoft(quality),
    upscale(quality),
    denoiseUpscale(quality),
  ]),
];

export function findEffect(className: string): EnhancementEffect {
  const effect = AVAILABLE_EFFECTS.find(candidate => candidate.className === className);
  if (!effect) throw new Error(`Unknown Anime4K effect: ${className}`);
  return effect;
}

export function resolveAiUpscaleEffect(mode: AiUpscaleMode, quality: QualityTier): EnhancementEffect {
  if (mode === 'CNNX2') {
    return { ...findEffect(`CNNx2${quality}`), alwaysApply: true };
  }
  if (mode === 'ARTCNN') {
    return {
      id: 'artcnn/C4F16/x2',
      name: 'ArtCNN C4F16 x2',
      className: 'ArtCNNX2',
      upscaleFactor: 2,
      alwaysApply: true,
      webgpuAvailable: true,
    };
  }
  if (mode === 'ACNET') {
    return {
      id: 'acnet/F8B4/x2',
      name: 'ACNet F8B4 x2',
      className: 'ACNetX2',
      upscaleFactor: 2,
      alwaysApply: true,
      webgpuAvailable: true,
    };
  }
  if (mode === 'ARNET') {
    return {
      id: 'arnet/F8B8/x2',
      name: 'ARNet F8B8 x2',
      className: 'ARNetX2',
      upscaleFactor: 2,
      alwaysApply: true,
      webgpuAvailable: true,
    };
  }
  if (mode === 'REALESRGAN') {
    return {
      id: 'realesrgan/animevideo-v3/x4',
      name: 'Real-ESRGAN AnimeVideo v3 x4',
      className: 'RealEsrganX4',
      upscaleFactor: 4,
      alwaysApply: true,
      webgpuAvailable: true,
      // Cap inference input height at 480px. animevideov3 x4 is ~1.2M params
      // and a 1080p source would feed the kernel roughly 6x more pixels than
      // a 480p source, with no perceptual quality gain that justifies the
      // extra latency on consumer GPUs. The presentation pass upscales the
      // 4x output to the canvas with its adaptive area sampler.
      params: { maxInferenceHeight: 480 },
    };
  }
  throw new Error(`Unknown AI upscale mode: ${mode satisfies never}`);
}
