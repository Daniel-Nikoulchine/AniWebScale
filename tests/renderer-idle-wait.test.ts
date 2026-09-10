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
});
