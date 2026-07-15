import { describe, expect, it } from 'vitest';
import { GENERATED_EXTERNAL_GLSL_MODELS } from '../src/shared/generated-external-glsl-models';

describe('generated external GLSL models', () => {
  it('pins the three intended real-time 2x graphs', () => {
    expect(Object.keys(GENERATED_EXTERNAL_GLSL_MODELS)).toEqual([
      'ArtCNNX2', 'ACNetX2', 'ARNetX2',
    ]);
    expect(GENERATED_EXTERNAL_GLSL_MODELS.ArtCNNX2.passes).toHaveLength(25);
    expect(GENERATED_EXTERNAL_GLSL_MODELS.ACNetX2.passes).toHaveLength(11);
    expect(GENERATED_EXTERNAL_GLSL_MODELS.ARNetX2.passes).toHaveLength(37);
    expect(Object.values(GENERATED_EXTERNAL_GLSL_MODELS).every(model => model.scale === 2)).toBe(true);
  });

  it('emits self-contained WGSL compute passes', () => {
    for (const model of Object.values(GENERATED_EXTERNAL_GLSL_MODELS)) {
      expect(model.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(model.pixelShuffleSource).toBeTruthy();
      for (const pass of model.passes) {
        expect(pass.wgsl).toContain('@compute');
        expect(pass.wgsl).toContain('fn computeMain');
        expect(pass.wgsl).toContain('textureStore(output_texture');
        expect(pass.wgsl).not.toMatch(/\b(?:vec[234]|ivec2|mat4)\b/);
        expect(pass.bindings.length).toBeGreaterThan(0);
      }
    }
  });
});
