import type {
  Anime4KMode,
  EnhancementEffect,
  EnhancementMode,
  QualityTier,
} from '../types';
import {
  OFFICIAL_PRESET_GRAPHS,
  type PresetStep,
} from '../shared/generated-preset-graph';
import { isAnime4KMode } from '../shared/presets';
import { findEffect, resolveAiUpscaleEffect } from './effects-map';

export { OFFICIAL_PRESET_GRAPHS, type PresetStep };

function classNameForStep(step: PresetStep, quality: QualityTier): string {
  switch (step) {
    case 'ClampHighlights': return 'ClampHighlights';
    case 'Restore': return `CNN${quality}`;
    case 'RestoreSoft': return `CNNSoft${quality}`;
    case 'Upscale': return `CNNx2${quality}`;
    case 'DenoiseUpscale': return `DenoiseCNNx2${quality}`;
  }
}

export function resolvePresetGraph(mode: Anime4KMode, quality: QualityTier): EnhancementEffect[] {
  return OFFICIAL_PRESET_GRAPHS[mode].map(step => findEffect(classNameForStep(step, quality)));
}

export function resolveEnhancementGraph(
  mode: EnhancementMode,
  quality: QualityTier,
): EnhancementEffect[] {
  if (mode === 'OFF') return [];
  return isAnime4KMode(mode)
    ? resolvePresetGraph(mode, quality)
    : [resolveAiUpscaleEffect(mode, quality)];
}

export function getEffectChainSummary(effects: EnhancementEffect[]): string {
  return effects.map(effect => effect.name.replace(/ \([^)]+\)$/, '')).join(' → ') || 'No effects';
}
