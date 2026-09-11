import { afterEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/core/renderer';

function idleRenderer(): any {
  const renderer = Object.create(Renderer.prototype) as any;
  renderer.frameProcessing = false;
  renderer.rebuilding = false;
  return renderer;
}

describe('renderer idle waits', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves immediately when no frame or rebuild holds resources', async () => {
    const renderer = idleRenderer();

    await expect(renderer.waitForFrameIdle()).resolves.toBeUndefined();
    await expect(renderer.waitForIdle()).resolves.toBeUndefined();
  });

  it('polls until the frame lock clears', async () => {
    const renderer = idleRenderer();
    renderer.frameProcessing = true;

    const waiting = renderer.waitForFrameIdle();
    renderer.frameProcessing = false;

    await expect(waiting).resolves.toBeUndefined();
  });

  it('times out via fake timers while the predicate stays true', async () => {
    vi.useFakeTimers();
    const renderer = idleRenderer();
    renderer.rebuilding = true;

    const waiting = renderer.waitForCondition(() => renderer.rebuilding, 100);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(waiting).resolves.toBeUndefined();
  });

  it('applyConfiguration waits out a frame-path rebuild instead of building concurrently', async () => {
    const renderer = idleRenderer();
    Object.assign(renderer, {
      destroyed: false,
      effects: [],
      targetDimensions: { width: 1, height: 1 },
      frameGenerationEnabled: false,
      pipelineEffectKey: 'stale',
      video: { videoWidth: 8, videoHeight: 8 },
      canvas: { width: 0, height: 0 },
      device: { queue: { onSubmittedWorkDone: async () => undefined } },
      frameGeneration: { flush: vi.fn(), createResources: vi.fn() },
      // A source-resize rebuild is in flight outside the state-update chain.
      rebuilding: true,
    });
    renderer.buildPipelines = vi.fn(async () => undefined);
    renderer.refreshFrameGenerationResources = vi.fn();
    renderer.processFrame = vi.fn(async () => true);
    renderer.stopFrameCallbacks = vi.fn();
    renderer.startFrameCallbacks = vi.fn();

    const updating = renderer.applyConfiguration({
      effects: [{ className: 'X' }],
      targetDimensions: { width: 2, height: 2 },
      frameGenerationEnabled: false,
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(renderer.buildPipelines).not.toHaveBeenCalled();
    renderer.rebuilding = false;
    await updating;
    expect(renderer.buildPipelines).toHaveBeenCalledOnce();
  });
});
