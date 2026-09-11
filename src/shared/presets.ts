import type {
  Anime4KMode,
  Dimensions,
  EnhancementMode,
  QualityTier,
} from '../types';
import {
  ANIME4K_MODES as GENERATED_ANIME4K_MODES,
  QUALITY_TIERS as GENERATED_QUALITY_TIERS,
} from './generated-preset-graph';
import { REALESRGAN_CAP_LADDER, type RealEsrganCapHeight } from './realesrgan-auto-cap';

export const ANIME4K_MODES: readonly Anime4KMode[] = GENERATED_ANIME4K_MODES;
export const QUALITY_TIERS: readonly QualityTier[] = GENERATED_QUALITY_TIERS;
export const AI_UPSCALE_MODES = [
  'REALESRGAN',
] as const;
export const ENHANCEMENT_MODES: readonly EnhancementMode[] = [
  'OFF',
  ...ANIME4K_MODES,
  ...AI_UPSCALE_MODES,
];

/**
 * The default RealESRGAN inference cap. Derived from the ladder's top rung so
 * settings, migration, scheduling and effects share one number.
 */
export const DEFAULT_REALESRGAN_CAP_HEIGHT: RealEsrganCapHeight = REALESRGAN_CAP_LADDER[0];

export const MODE_TO_ID: Record<EnhancementMode, string> = {
  OFF: 'disabled',
  A: 'builtin-mode-a',
  B: 'builtin-mode-b',
  C: 'builtin-mode-c',
  AA: 'builtin-mode-aa',
  BB: 'builtin-mode-bb',
  CA: 'builtin-mode-ca',
  REALESRGAN: 'ai-realesrgan-animevideo-v3-x4',
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
  return ANIME4K_MODES.includes(mode as Anime4KMode);
}

export function isQualityTier(value: unknown): value is QualityTier {
  return typeof value === 'string' && QUALITY_TIERS.includes(value as QualityTier);
}

export function legacyTierToQuality(tier: unknown): QualityTier {
  if (tier === 'performance') return 'M';
  if (tier === 'balanced') return 'VL';
  if (tier === 'quality' || tier === 'ultra') return 'UL';
  return 'VL';
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
