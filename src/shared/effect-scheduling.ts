import type { Dimensions, EnhancementEffect } from '../types';

export interface ScheduledEffects {
  effects: EnhancementEffect[];
  finalDimensions: Dimensions;
}

function effectPipelineKey(effect: EnhancementEffect): string {
  return JSON.stringify([
    effect.className,
    effect.params ?? null,
    effect.upscaleFactor ?? 1,
  ]);
}

/**
 * Apply the official Anime4K `//!WHEN OUTPUT / MAIN > 1.2` condition used by
 * every x2 and denoise-x2 model. Non-upscaling restore passes always remain in
 * the selected graph, including in A+A, B+B and C+A.
 */
export function scheduleEffectsForTarget(
  effects: readonly EnhancementEffect[],
  sourceDimensions: Dimensions,
  targetDimensions: Dimensions,
): ScheduledEffects {
  let width = Math.max(1, sourceDimensions.width);
  let height = Math.max(1, sourceDimensions.height);
  const scheduled: EnhancementEffect[] = [];

  for (const effect of effects) {
    const scale = effect.upscaleFactor ?? 1;
    if (!effect.alwaysApply && scale > 1
      && !(targetDimensions.width / width > 1.2 && targetDimensions.height / height > 1.2)) {
      continue;
    }
    scheduled.push(effect);
    width *= scale;
    height *= scale;
  }

  return { effects: scheduled, finalDimensions: { width, height } };
}

/**
 * Identity of the GPU pipeline actually needed for a source/target pair.
 * Resizing within one scheduling band does not require shader recompilation.
 */
export function scheduledEffectPipelineKey(
  effects: readonly EnhancementEffect[],
  sourceDimensions: Dimensions,
  targetDimensions: Dimensions,
): string {
  return scheduleEffectsForTarget(effects, sourceDimensions, targetDimensions)
    .effects
    .map(effectPipelineKey)
    .join('|');
}
