import type { Dimensions, EnhancementEffect } from '../types';
import { scheduledEffectPipelineKey } from '../shared/effect-scheduling';

/** The renderer's config state that the diff function reads. */
export interface RendererConfigState {
  effects: EnhancementEffect[];
  targetDimensions: Dimensions;
  frameGenerationEnabled: boolean;
  pipelineEffectKey: string;
}

/** An incoming configuration update. */
export interface RendererConfigNext {
  effects: EnhancementEffect[];
  targetDimensions: Dimensions;
  frameGenerationEnabled: boolean;
}

/** What changed between the current state and the next one. */
export interface RendererConfigDiff {
  /** True when every field is identical — the caller can skip all work. */
  isUnchanged: boolean;
  /** True when the GPU pipeline key differs — a shader recompile is needed. */
  needsPipelineRebuild: boolean;
  /** True when the frame-generation flag toggled, but no pipeline rebuild. */
  frameGenerationChanged: boolean;
  /** The pipeline key the next config would produce. */
  nextPipelineEffectKey: string;
}

/**
 * Compare the current renderer config state against a proposed update and
 * produce a structured diff. Pure function — no GPU, no DOM, no side effects.
 */
export function diffRendererConfig(
  current: RendererConfigState,
  next: RendererConfigNext,
  sourceDimensions: Dimensions,
): RendererConfigDiff {
  const isUnchanged = JSON.stringify(current.effects) === JSON.stringify(next.effects)
    && current.targetDimensions.width === next.targetDimensions.width
    && current.targetDimensions.height === next.targetDimensions.height
    && current.frameGenerationEnabled === next.frameGenerationEnabled;

  const nextPipelineEffectKey = scheduledEffectPipelineKey(
    next.effects,
    sourceDimensions,
    next.targetDimensions,
  );

  return {
    isUnchanged,
    needsPipelineRebuild: nextPipelineEffectKey !== current.pipelineEffectKey,
    frameGenerationChanged: current.frameGenerationEnabled !== next.frameGenerationEnabled,
    nextPipelineEffectKey,
  };
}