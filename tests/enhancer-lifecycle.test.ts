import { describe, expect, it } from 'vitest';
import { EnhancerLifecycle } from '../src/core/enhancer-lifecycle';

describe('EnhancerLifecycle', () => {
  it('runs queued transitions in order and continues after failure', async () => {
    const lifecycle = new EnhancerLifecycle();
    const events: string[] = [];

    const first = lifecycle.enqueue(async () => {
      events.push('first:start');
      await Promise.resolve();
      events.push('first:end');
      throw new Error('first failed');
    });
    const second = lifecycle.enqueue(async () => {
      events.push('second');
    });

    await expect(first).rejects.toThrow('first failed');
    await expect(second).resolves.toBeUndefined();
    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });

  it('invalidates an earlier transition when a newer one begins', () => {
    const lifecycle = new EnhancerLifecycle();
    const first = lifecycle.begin();
    const second = lifecycle.begin();

    expect(lifecycle.isCurrent(first)).toBe(false);
    expect(lifecycle.isCurrent(second)).toBe(true);
  });

  it('invalidates the active transition on destroy', () => {
    const lifecycle = new EnhancerLifecycle();
    const revision = lifecycle.begin();
    lifecycle.invalidate();

    expect(lifecycle.isCurrent(revision)).toBe(false);
  });
});
