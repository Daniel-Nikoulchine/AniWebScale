import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EnhancerStatsConsumer,
  type StatsConsumerContext,
} from '../src/core/enhancer-stats-consumer';
import type { Anime4KWebExtSettings, RenderStats } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/utils/settings';

const OVERLOAD_STATS: RenderStats = {
  fps: 24,
  renderMs: 60,
  droppedFrames: 0,
  warning: true,
  realesrgan: {
    readbackMs: 5, inferMs: 50, composeMs: 2, runnerPct: 100, gpuComposePct: 0, nativePct: 0,
    count: 12, enhancedFps: 10,
  },
  frameBudgetMs: 1000 / 24,
};

function realesrganSettings(capHeight: 480 | 432 | 405 = 480) {
  return { ...DEFAULT_SETTINGS, mode: 'REALESRGAN' as const, realesrganCapHeight: capHeight };
}

function createHarness(overrides: Partial<StatsConsumerContext> = {}) {
  const canvas = { width: 0, height: 0 };
  const updateConfiguration = vi.fn(async (_config: { effects?: Array<{ params?: Record<string, unknown> }> }) => undefined);
  const renderer = { updateConfiguration };
  const setOverlayStats = vi.fn();
  let settings: Anime4KWebExtSettings = { ...realesrganSettings(), statsEnabled: true };
  let webgpu = true;
  let destroyed = false;
  const context: StatsConsumerContext = {
    isDestroyed: () => destroyed,
    getSettings: () => settings,
    getRenderer: () => renderer as never,
    isWebGPUActive: () => webgpu,
    getVideo: () => ({
      getBoundingClientRect: () => ({ width: 640, height: 360 }),
      videoWidth: 640,
      videoHeight: 360,
    }) as unknown as HTMLVideoElement,
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    setOverlayStats,
    enqueue: operation => operation(),
    onRendererError: vi.fn(async () => undefined),
    ...overrides,
  };
  const consumer = new EnhancerStatsConsumer(context);
  return {
    consumer,
    updateConfiguration,
    setOverlayStats,
    setSettings: (next: Anime4KWebExtSettings) => { settings = next; },
    setWebgpu: (next: boolean) => { webgpu = next; },
    setDestroyed: (next: boolean) => { destroyed = next; },
  };
}

describe('EnhancerStatsConsumer', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      screen: { width: 1920, height: 1080 },
      setTimeout: vi.fn(() => 7),
      clearTimeout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fans stats to the overlay only while stats are enabled', () => {
    const { consumer, setOverlayStats, setSettings } = createHarness();
    consumer.handleStats(OVERLOAD_STATS);
    expect(setOverlayStats).toHaveBeenLastCalledWith(OVERLOAD_STATS);

    setSettings({ ...DEFAULT_SETTINGS, statsEnabled: false });
    consumer.handleStats(OVERLOAD_STATS);
    expect(setOverlayStats).toHaveBeenLastCalledWith(null);
  });

  it('steps the RealESRGAN auto-cap on sustained overload and rebuilds effects', () => {
    const { consumer, updateConfiguration } = createHarness();
    consumer.handleStats(OVERLOAD_STATS);

    expect(updateConfiguration).toHaveBeenCalledOnce();
    const effects = updateConfiguration.mock.calls[0]![0].effects!;
    expect(effects[0]!.params).toMatchObject({ maxInferenceHeight: 432 });
    expect(consumer.effectiveAutoCap).toBe(432);
  });

  it('does not step when RealESRGAN is not webgpu-active', () => {
    const { consumer, updateConfiguration, setWebgpu } = createHarness();
    setWebgpu(false);
    consumer.handleStats(OVERLOAD_STATS);
    expect(updateConfiguration).not.toHaveBeenCalled();
    expect(consumer.effectiveAutoCap).toBeNull();
  });

  it('retargets the override to the stored cap on a settings change', () => {
    const { consumer } = createHarness();
    consumer.handleStats(OVERLOAD_STATS);
    expect(consumer.effectiveAutoCap).toBe(432);

    consumer.applySettings(realesrganSettings(405));
    expect(consumer.effectiveAutoCap).toBe(405);
  });

  it('drops the ephemeral cap when the mode leaves RealESRGAN or resources release', () => {
    const { consumer, setSettings } = createHarness();
    consumer.handleStats(OVERLOAD_STATS);
    expect(consumer.effectiveAutoCap).toBe(432);

    const plain: Anime4KWebExtSettings = { ...DEFAULT_SETTINGS, mode: 'A' };
    setSettings(plain);
    consumer.applySettings(plain);
    expect(consumer.effectiveAutoCap).toBeNull();

    consumer.handleStats(OVERLOAD_STATS);
    const realesrgan = realesrganSettings();
    setSettings(realesrgan);
    consumer.applySettings(realesrgan);
    consumer.handleStats(OVERLOAD_STATS);
    expect(consumer.effectiveAutoCap).toBe(432);
    consumer.releaseResources();
    expect(consumer.effectiveAutoCap).toBeNull();
  });

  it('queues a delayed auto-target refresh and clearTargetUpdate cancels it', () => {
    const { consumer } = createHarness();
    consumer.scheduleTargetUpdate();
    expect(window.setTimeout).toHaveBeenCalledOnce();
    consumer.clearTargetUpdate();
    expect(window.clearTimeout).toHaveBeenCalledWith(7);
  });

  it('does not queue an auto-target refresh without a live renderer or after destroy', () => {
    createHarness({ getRenderer: () => null }).consumer.scheduleTargetUpdate();
    createHarness({ isDestroyed: () => true }).consumer.scheduleTargetUpdate();
    expect(window.setTimeout).not.toHaveBeenCalled();
  });
});
