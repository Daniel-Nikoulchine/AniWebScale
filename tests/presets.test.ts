import { describe, expect, it } from 'vitest';
import {
  ANIME4K_MODES,
  AI_UPSCALE_MODES,
  ENHANCEMENT_MODES,
  ID_TO_MODE,
  LEGACY_BASE_TO_MODE,
  MODE_TO_ID,
  MODE_TO_LEGACY_BASE,
  QUALITY_TIERS,
  calculateAutoTargetSize,
  isDoubleMode,
  legacyTierToQuality,
  isProcessingEnabled,
  modeUsesQuality,
  qualityToLegacyTier,
  supportsOnnxWebGpuRuntime,
  supportsWebGpuConfiguration,
} from '../src/shared/presets';
import {
  scheduleEffectsForTarget,
  scheduledEffectPipelineKey,
} from '../src/shared/effect-scheduling';
import {
  OFFICIAL_PRESET_GRAPHS,
  resolveEnhancementGraph,
  resolvePresetGraph,
} from '../src/utils/effect-chain-templates';

describe('official Anime4K presets', () => {
  it('exposes all 18 mode and quality combinations', () => {
    const combinations = ANIME4K_MODES.flatMap((mode) =>
      QUALITY_TIERS.map((quality) => `${mode}:${quality}`),
    );

    expect(combinations).toHaveLength(18);
    expect(new Set(combinations).size).toBe(18);
  });

  it('round-trips current and legacy mode identifiers', () => {
    for (const mode of ANIME4K_MODES) {
      expect(ID_TO_MODE[MODE_TO_ID[mode]]).toBe(mode);
      expect(LEGACY_BASE_TO_MODE[MODE_TO_LEGACY_BASE[mode]]).toBe(mode);
    }
  });

  it('identifies only the chained double-upscale modes', () => {
    expect(ANIME4K_MODES.filter(isDoubleMode)).toEqual(['AA', 'BB', 'CA']);
  });

  it('migrates legacy performance tiers deterministically', () => {
    expect(qualityToLegacyTier('M')).toBe('performance');
    expect(qualityToLegacyTier('VL')).toBe('balanced');
    expect(qualityToLegacyTier('UL')).toBe('ultra');
    expect(legacyTierToQuality('quality')).toBe('UL');
    expect(legacyTierToQuality(undefined)).toBe('VL');
  });

  it('uses the official six processing graphs', () => {
    expect(OFFICIAL_PRESET_GRAPHS).toEqual({
      A: ['ClampHighlights', 'Restore', 'Upscale'],
      B: ['ClampHighlights', 'RestoreSoft', 'Upscale'],
      C: ['ClampHighlights', 'DenoiseUpscale'],
      AA: ['ClampHighlights', 'Restore', 'Upscale', 'Restore', 'Upscale'],
      BB: ['ClampHighlights', 'RestoreSoft', 'Upscale', 'RestoreSoft', 'Upscale'],
      CA: ['ClampHighlights', 'DenoiseUpscale', 'Restore', 'Upscale'],
    });
  });

  it('resolves every graph at the explicitly selected quality', () => {
    for (const mode of ANIME4K_MODES) {
      for (const quality of QUALITY_TIERS) {
        const effects = resolvePresetGraph(mode, quality);
        expect(effects.length).toBe(OFFICIAL_PRESET_GRAPHS[mode].length);
        for (const effect of effects) {
          if (effect.className !== 'ClampHighlights') {
            expect(effect.className.endsWith(quality)).toBe(true);
          }
        }
      }
    }
  });

  it('applies the official 1.2x upscale condition used by the native graph', () => {
    const source = { width: 1920, height: 1080 };
    const target = { width: 2560, height: 1440 };
    expect(scheduleEffectsForTarget(resolvePresetGraph('A', 'M'), source, target).effects
      .map(effect => effect.className)).toEqual(['ClampHighlights', 'CNNM', 'CNNx2M']);
    expect(scheduleEffectsForTarget(resolvePresetGraph('AA', 'M'), source, target).effects
      .map(effect => effect.className)).toEqual(['ClampHighlights', 'CNNM', 'CNNx2M', 'CNNM']);
    expect(scheduleEffectsForTarget(resolvePresetGraph('AA', 'M'), source, source).effects
      .map(effect => effect.className)).toEqual(['ClampHighlights', 'CNNM', 'CNNM']);
    expect(scheduleEffectsForTarget(
      resolvePresetGraph('AA', 'M'),
      source,
      { width: 7680, height: 4320 },
    ).effects.map(effect => effect.className)).toEqual([
      'ClampHighlights', 'CNNM', 'CNNx2M', 'CNNM', 'CNNx2M',
    ]);
  });

  it('reuses a compiled pipeline until the scheduled effect graph changes', () => {
    const source = { width: 1920, height: 1080 };
    const effects = resolvePresetGraph('A', 'M');
    const first = scheduledEffectPipelineKey(effects, source, { width: 2560, height: 1440 });
    const resized = scheduledEffectPipelineKey(effects, source, { width: 3000, height: 1688 });
    const belowThreshold = scheduledEffectPipelineKey(effects, source, { width: 2200, height: 1238 });

    expect(resized).toBe(first);
    expect(belowThreshold).not.toBe(first);
  });

  it('exposes CNN, GLSL, and ONNX anime upscalers at fixed scales', () => {
    expect(AI_UPSCALE_MODES).toEqual([
      'CNNX2', 'ARTCNN', 'ACNET', 'ARNET', 'ANIMEJANAI',
    ]);
    expect(resolveEnhancementGraph('CNNX2', 'VL')[0]).toMatchObject({
      className: 'CNNx2VL', upscaleFactor: 2, alwaysApply: true,
    });
    expect(resolveEnhancementGraph('ANIMEJANAI', 'M')[0]).toMatchObject({
      className: 'AnimeJaNaiX2', upscaleFactor: 2, alwaysApply: true,
    });
    expect(resolveEnhancementGraph('ARTCNN', 'M')[0]).toMatchObject({
      className: 'ArtCNNX2', upscaleFactor: 2, alwaysApply: true,
    });
    expect(resolveEnhancementGraph('ACNET', 'M')[0]).toMatchObject({
      className: 'ACNetX2', upscaleFactor: 2, alwaysApply: true,
    });
    expect(resolveEnhancementGraph('ARNET', 'M')[0]).toMatchObject({
      className: 'ARNetX2', upscaleFactor: 2, alwaysApply: true,
    });
  });

  it('exposes an off mode that can still run frame generation', () => {
    expect(ENHANCEMENT_MODES[0]).toBe('OFF');
    expect(resolveEnhancementGraph('OFF', 'M')).toEqual([]);
    expect(modeUsesQuality('OFF')).toBe(false);
    expect(isProcessingEnabled('OFF', false)).toBe(false);
    expect(isProcessingEnabled('OFF', true)).toBe(true);
    expect(ID_TO_MODE[MODE_TO_ID.OFF]).toBe('OFF');
  });

  it('marks only Firefox as unsupported for browser ONNX WebGPU runtimes', () => {
    expect(supportsOnnxWebGpuRuntime('Mozilla/5.0 Firefox/147.0')).toBe(false);
    expect(supportsOnnxWebGpuRuntime('Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36')).toBe(true);
    expect(supportsWebGpuConfiguration('ANIMEJANAI', 'Mozilla/5.0 Firefox/147.0')).toBe(false);
    expect(supportsWebGpuConfiguration('ANIMEJANAI', 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36')).toBe(true);
    expect(supportsWebGpuConfiguration('ARTCNN', 'Mozilla/5.0 Firefox/147.0')).toBe(true);
  });

  it('targets physical player pixels and preserves source aspect ratio', () => {
    expect(calculateAutoTargetSize({
      playerWidth: 1280,
      playerHeight: 720,
      devicePixelRatio: 2,
      screenWidth: 1280,
      screenHeight: 720,
      sourceWidth: 1920,
      sourceHeight: 1080,
    })).toEqual({ width: 2560, height: 1440 });

    expect(calculateAutoTargetSize({
      playerWidth: 1000,
      playerHeight: 1000,
      devicePixelRatio: 1,
      screenWidth: 2560,
      screenHeight: 1440,
      sourceWidth: 1920,
      sourceHeight: 1080,
    })).toEqual({ width: 1000, height: 563 });
  });
});
