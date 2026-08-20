import { describe, expect, it } from 'vitest';
import { diffRendererConfig } from '../src/core/renderer-config';
import type { EnhancementEffect } from '../src/types';

const source: EnhancementEffect[] = [{
  id: 'a', name: 'A', className: 'Restore', alwaysApply: true,
}];
const other: EnhancementEffect[] = [{
  id: 'b', name: 'B', className: 'Upscale', alwaysApply: true, upscaleFactor: 2,
}];

const sourceDimensions = { width: 1280, height: 720 };

function current(overrides: Partial<Parameters<typeof diffRendererConfig>[0]> = {}) {
  return {
    effects: source,
    targetDimensions: { width: 2560, height: 1440 },
    frameGenerationEnabled: false,
    pipelineEffectKey: '["Restore",null,1]',
    ...overrides,
  };
}

describe('diffRendererConfig', () => {
  it('reports isUnchanged when nothing changed', () => {
    const diff = diffRendererConfig(current(), {
      effects: source,
      targetDimensions: { width: 2560, height: 1440 },
      frameGenerationEnabled: false,
    }, sourceDimensions);

    expect(diff.isUnchanged).toBe(true);
    expect(diff.needsPipelineRebuild).toBe(false);
    expect(diff.frameGenerationChanged).toBe(false);
  });

  it('flags a pipeline rebuild when the effects change', () => {
    const diff = diffRendererConfig(current(), {
      effects: other,
      targetDimensions: { width: 2560, height: 1440 },
      frameGenerationEnabled: false,
    }, sourceDimensions);

    expect(diff.isUnchanged).toBe(false);
    expect(diff.needsPipelineRebuild).toBe(true);
    expect(diff.frameGenerationChanged).toBe(false);
  });

  it('flags a pipeline rebuild when the pipeline key differs but effects look equal', () => {
    // The pipeline key is computed from className/params/upscaleFactor, so two
    // effect lists with the same id but different params produce a rebuild.
    const tweaked: EnhancementEffect[] = [{
      ...source[0],
      params: { strength: 2 },
    }];
    const diff = diffRendererConfig(current(), {
      effects: tweaked,
      targetDimensions: { width: 2560, height: 1440 },
      frameGenerationEnabled: false,
    }, sourceDimensions);

    expect(diff.needsPipelineRebuild).toBe(true);
    expect(diff.nextPipelineEffectKey).not.toBe(current().pipelineEffectKey);
  });

  it('flags only frameGenerationChanged when that flag toggles and effects stay put', () => {
    const diff = diffRendererConfig(current(), {
      effects: source,
      targetDimensions: { width: 2560, height: 1440 },
      frameGenerationEnabled: true,
    }, sourceDimensions);

    expect(diff.isUnchanged).toBe(false);
    expect(diff.needsPipelineRebuild).toBe(false);
    expect(diff.frameGenerationChanged).toBe(true);
  });

  it('reports the exact next pipeline key', () => {
    const diff = diffRendererConfig(current(), {
      effects: other,
      targetDimensions: { width: 2560, height: 1440 },
      frameGenerationEnabled: false,
    }, sourceDimensions);

    expect(diff.nextPipelineEffectKey).toBe('["Upscale",null,2]');
  });

  it('computes the key against the source dimensions', () => {
    // An upscale effect is dropped when the target is not >1.2x the source,
    // so a smaller source changes the pipeline key even with identical config.
    const conditionalUpscale: EnhancementEffect[] = [{
      id: 'b', name: 'B', className: 'Upscale', alwaysApply: false, upscaleFactor: 2,
    }];
    const diff = diffRendererConfig(current(), {
      effects: conditionalUpscale,
      targetDimensions: { width: 2560, height: 1440 },
      frameGenerationEnabled: false,
    }, { width: 2560, height: 1440 });

    // target/source = 1.0 → the x2 upscale is dropped from the schedule
    expect(diff.nextPipelineEffectKey).toBe('');
  });
});
