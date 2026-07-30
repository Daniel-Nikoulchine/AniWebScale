import { describe, expect, it } from 'vitest';
import {
  scheduleEffectsForTarget,
  scheduledEffectPipelineKey,
} from '../src/shared/effect-scheduling';
import type { EnhancementEffect } from '../src/types';

const restore: EnhancementEffect = {
  id: 'restore',
  name: 'Restore',
  className: 'Restore',
  upscaleFactor: 1,
};

const upscaleX2: EnhancementEffect = {
  id: 'upscale-x2',
  name: 'Upscale x2',
  className: 'Upscale',
  upscaleFactor: 2,
};

const alwaysOn: EnhancementEffect = {
  id: 'always',
  name: 'Always',
  className: 'Always',
  upscaleFactor: 2,
  alwaysApply: true,
};

describe('scheduleEffectsForTarget', () => {
  it('keeps non-upscaling restore passes regardless of the target ratio', () => {
    const result = scheduleEffectsForTarget([restore], { width: 1920, height: 1080 }, { width: 1920, height: 1080 });
    expect(result.effects).toHaveLength(1);
    expect(result.finalDimensions).toEqual({ width: 1920, height: 1080 });
  });

  it('drops an x2 upscale when the target is not at least 1.2x larger in both axes', () => {
    // 1920x1080 -> 1920x1080 is a 1.0 ratio, below the 1.2 threshold.
    const result = scheduleEffectsForTarget([upscaleX2], { width: 1920, height: 1080 }, { width: 1920, height: 1080 });
    expect(result.effects).toHaveLength(0);
    expect(result.finalDimensions).toEqual({ width: 1920, height: 1080 });
  });

  it('applies an x2 upscale when the target exceeds the 1.2x threshold and scales the output', () => {
    // 960x540 -> 3840x2160 is a 4x ratio, well above 1.2.
    const result = scheduleEffectsForTarget([upscaleX2], { width: 960, height: 540 }, { width: 3840, height: 2160 });
    expect(result.effects).toHaveLength(1);
    expect(result.finalDimensions).toEqual({ width: 1920, height: 1080 });
  });

  it('requires BOTH axes to exceed the threshold before upscaling', () => {
    // Width ratio 4x but height ratio 1x -> the upscale must be skipped.
    const result = scheduleEffectsForTarget([upscaleX2], { width: 960, height: 1080 }, { width: 3840, height: 1080 });
    expect(result.effects).toHaveLength(0);
  });

  it('always applies effects flagged alwaysApply even below the threshold', () => {
    const result = scheduleEffectsForTarget([alwaysOn], { width: 1920, height: 1080 }, { width: 1920, height: 1080 });
    expect(result.effects).toHaveLength(1);
    expect(result.finalDimensions).toEqual({ width: 3840, height: 2160 });
  });

  it('chains multiple effects, scaling dimensions cumulatively', () => {
    const result = scheduleEffectsForTarget(
      [restore, upscaleX2, upscaleX2],
      { width: 960, height: 540 },
      { width: 7680, height: 4320 },
    );
    expect(result.effects).toHaveLength(3);
    expect(result.finalDimensions).toEqual({ width: 3840, height: 2160 });
  });

  it('clamps zero or negative source dimensions to at least 1', () => {
    const result = scheduleEffectsForTarget([restore], { width: 0, height: -5 }, { width: 100, height: 100 });
    expect(result.finalDimensions).toEqual({ width: 1, height: 1 });
  });
});

describe('scheduledEffectPipelineKey', () => {
  it('is stable for source/target pairs inside the same scheduling band', () => {
    const a = scheduledEffectPipelineKey([upscaleX2], { width: 960, height: 540 }, { width: 3840, height: 2160 });
    const b = scheduledEffectPipelineKey([upscaleX2], { width: 900, height: 500 }, { width: 3600, height: 2000 });
    expect(a).toBe(b);
  });

  it('changes when the scheduling decision changes', () => {
    const upscaled = scheduledEffectPipelineKey([upscaleX2], { width: 960, height: 540 }, { width: 3840, height: 2160 });
    const skipped = scheduledEffectPipelineKey([upscaleX2], { width: 1920, height: 1080 }, { width: 1920, height: 1080 });
    expect(upscaled).not.toBe(skipped);
  });

  it('distinguishes effects with different params', () => {
    const withParams: EnhancementEffect = { ...upscaleX2, params: { strength: 1 } };
    const a = scheduledEffectPipelineKey([upscaleX2], { width: 960, height: 540 }, { width: 3840, height: 2160 });
    const b = scheduledEffectPipelineKey([withParams], { width: 960, height: 540 }, { width: 3840, height: 2160 });
    expect(a).not.toBe(b);
  });
});
