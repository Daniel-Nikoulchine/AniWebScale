import type {
  Anime4KMode,
  BaseMode,
  Dimensions,
  EnhancementMode,
  PerformanceTier,
  QualityTier,
} from '../types';
import {
  ANIME4K_MODES as GENERATED_ANIME4K_MODES,
  QUALITY_TIERS as GENERATED_QUALITY_TIERS,
} from './generated-preset-graph';

export const ANIME4K_MODES: readonly Anime4KMode[] = GENERATED_ANIME4K_MODES;
export const QUALITY_TIERS: readonly QualityTier[] = GENERATED_QUALITY_TIERS;
export const AI_UPSCALE_MODES = [
  'CNNX2', 'ARTCNN', 'ACNET', 'ARNET',
] as const;
export const ENHANCEMENT_MODES: readonly EnhancementMode[] = [
  'OFF',
  ...ANIME4K_MODES,
  ...AI_UPSCALE_MODES,
];

export const MODE_DESCRIPTIONS: Record<EnhancementMode, string> = {
  OFF: 'Disables image enhancement. Frame generation can still be enabled separately.',
  A: 'Restores line detail, then applies Anime4K CNN upscaling. The balanced default for most anime.',
  B: 'Uses softer restoration before Anime4K CNN upscaling to reduce ringing on blurry or compressed video.',
  C: 'Denoises and upscales in one Anime4K CNN pass. Best suited to visibly noisy animation.',
  AA: 'Runs the Anime4K A restoration chain twice for stronger detail and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.',
  BB: 'Runs the softer Anime4K B chain twice for blurry sources and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.',
  CA: 'Denoises and upscales first, then restores and can upscale again. UL is a high-end GPU profile outside the 24 FPS baseline.',
  CNNX2: 'Official Anime4K CNN at a fixed 2x scale. Produces a sharp result; Quality changes model size and GPU load.',
  ARTCNN: 'Fixed 2x GLSL network for reconstructing anime line art and natural detail at real-time speed.',
  ACNET: 'Small fixed 2x GLSL network that prioritizes speed and very low GPU load over maximum detail recovery.',
  ARNET: 'Deeper fixed 2x GLSL network with stronger detail recovery than ACNet at a higher, balanced GPU load.',
};

export const MODE_TO_LEGACY_BASE: Record<Anime4KMode, BaseMode> = {
  A: 'A',
  B: 'B',
  C: 'C',
  AA: 'A+A',
  BB: 'B+B',
  CA: 'C+A',
};

export const LEGACY_BASE_TO_MODE: Record<BaseMode, Anime4KMode> = {
  A: 'A',
  B: 'B',
  C: 'C',
  'A+A': 'AA',
  'B+B': 'BB',
  'C+A': 'CA',
};

export const MODE_TO_ID: Record<EnhancementMode, string> = {
  OFF: 'disabled',
  A: 'builtin-mode-a',
  B: 'builtin-mode-b',
  C: 'builtin-mode-c',
  AA: 'builtin-mode-aa',
  BB: 'builtin-mode-bb',
  CA: 'builtin-mode-ca',
  CNNX2: 'ai-cnn-x2',
  ARTCNN: 'ai-artcnn-c4f16-glsl-x2',
  ACNET: 'ai-acnet-f8b4-glsl-x2',
  ARNET: 'ai-arnet-f8b8-glsl-x2',
};

export const ID_TO_MODE: Record<string, EnhancementMode> = Object.fromEntries(
  Object.entries(MODE_TO_ID).map(([mode, id]) => [id, mode]),
) as Record<string, EnhancementMode>;

export function isAnime4KMode(value: unknown): value is Anime4KMode {
  return typeof value === 'string' && ANIME4K_MODES.includes(value as Anime4KMode);
}

export function isEnhancementMode(value: unknown): value is EnhancementMode {
  return typeof value === 'string' && ENHANCEMENT_MODES.includes(value as EnhancementMode);
}

export function isProcessingEnabled(mode: EnhancementMode, frameGenerationEnabled = false): boolean {
  return mode !== 'OFF' || frameGenerationEnabled;
}

export function modeUsesQuality(mode: EnhancementMode): boolean {
  return ANIME4K_MODES.includes(mode as Anime4KMode) || mode === 'CNNX2';
}

export function isQualityTier(value: unknown): value is QualityTier {
  return typeof value === 'string' && QUALITY_TIERS.includes(value as QualityTier);
}

export function qualityToLegacyTier(quality: QualityTier): PerformanceTier {
  if (quality === 'M') return 'performance';
  if (quality === 'VL') return 'balanced';
  return 'ultra';
}

export function legacyTierToQuality(tier: unknown): QualityTier {
  if (tier === 'performance') return 'M';
  if (tier === 'quality' || tier === 'ultra') return 'UL';
  return 'VL';
}

export function isDoubleMode(mode: EnhancementMode): boolean {
  return mode === 'AA' || mode === 'BB' || mode === 'CA';
}

export interface AutoTargetInput {
  playerWidth: number;
  playerHeight: number;
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}

export function calculateAutoTargetSize(input: AutoTargetInput): Dimensions {
  const dpr = Math.max(1, input.devicePixelRatio || 1);
  const screenWidth = Math.max(1, Math.floor(input.screenWidth * dpr));
  const screenHeight = Math.max(1, Math.floor(input.screenHeight * dpr));
  const availableWidth = Math.max(1, Math.min(screenWidth, Math.round(input.playerWidth * dpr)));
  const availableHeight = Math.max(1, Math.min(screenHeight, Math.round(input.playerHeight * dpr)));
  const sourceWidth = Math.max(1, input.sourceWidth || Math.round(input.playerWidth) || 1);
  const sourceHeight = Math.max(1, input.sourceHeight || Math.round(input.playerHeight) || 1);
  const aspect = sourceWidth / sourceHeight;

  let width = availableWidth;
  let height = Math.round(width / aspect);
  if (height > availableHeight) {
    height = availableHeight;
    width = Math.round(height * aspect);
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

/**
 * Resolve Auto output to physical player pixels while preserving the source
 * aspect ratio and never exceeding the current monitor's reported bounds.
 */
export function calculateAutoTargetDimensions(video: HTMLVideoElement): Dimensions {
  const rect = video.getBoundingClientRect();
  return calculateAutoTargetSize({
    playerWidth: rect.width,
    playerHeight: rect.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    sourceWidth: video.videoWidth,
    sourceHeight: video.videoHeight,
  });
}
