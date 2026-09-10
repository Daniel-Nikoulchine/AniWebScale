/**
 * Render stats tap: fan-out, unsubscribe and emission order through one seam.
 */
import { describe, expect, it } from 'vitest';
import { createRenderStatsTap } from '../src/core/render-stats-tap';
import type { RenderStats } from '../src/types';

function sampleStats(warning: boolean): RenderStats {
  return { fps: 24, renderMs: 10, droppedFrames: 0, warning };
}

describe('createRenderStatsTap', () => {
  it('fans one emission out to every subscriber', () => {
    const tap = createRenderStatsTap();
    const seenA: RenderStats[] = [];
    const seenB: RenderStats[] = [];
    tap.subscribe(stats => seenA.push(stats));
    tap.subscribe(stats => seenB.push(stats));
    const stats = sampleStats(true);
    tap.emit(stats);
    expect(seenA).toEqual([stats]);
    expect(seenB).toEqual([stats]);
  });

  it('stops delivery after unsubscribe', () => {
    const tap = createRenderStatsTap();
    const seen: RenderStats[] = [];
    const unsubscribe = tap.subscribe(stats => seen.push(stats));
    tap.emit(sampleStats(false));
    unsubscribe();
    tap.emit(sampleStats(true));
    expect(seen).toHaveLength(1);
  });

  it('a throwing subscriber does not exist here: emissions stay isolated per listener', () => {
    const tap = createRenderStatsTap();
    const order: string[] = [];
    tap.subscribe(() => order.push('first'));
    tap.subscribe(() => order.push('second'));
    tap.emit(sampleStats(false));
    expect(order).toEqual(['first', 'second']);
  });

  it('a throwing subscriber neither starves later listeners nor unwinds emit', () => {
    const tap = createRenderStatsTap();
    const seen: RenderStats[] = [];
    tap.subscribe(() => { throw new Error('overlay boom'); });
    tap.subscribe(stats => seen.push(stats));
    const stats = sampleStats(true);
    expect(() => tap.emit(stats)).not.toThrow();
    expect(seen).toEqual([stats]);
  });
});
