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

  it('keeps the reconcile token separate from transition revisions', () => {
    const lifecycle = new EnhancerLifecycle();
    lifecycle.begin();
    const transition = lifecycle.begin();
    const reconcile = lifecycle.beginReconcile();

    expect(lifecycle.isReconcileCurrent(reconcile)).toBe(true);
    expect(lifecycle.isCurrent(reconcile)).toBe(false);
    expect(lifecycle.isReconcileCurrent(transition)).toBe(false);
    expect(lifecycle.currentReconcileToken()).toBe(reconcile);
  });

  it('invalidates an earlier reconcile token when a newer reconcile begins', () => {
    const lifecycle = new EnhancerLifecycle();
    const first = lifecycle.beginReconcile();
    const second = lifecycle.beginReconcile();

    expect(lifecycle.isReconcileCurrent(first)).toBe(false);
    expect(lifecycle.isReconcileCurrent(second)).toBe(true);
  });

  it('invalidates every pending reconcile token', () => {
    const lifecycle = new EnhancerLifecycle();
    const token = lifecycle.beginReconcile();
    lifecycle.invalidateReconcile();

    expect(lifecycle.isReconcileCurrent(token)).toBe(false);
    expect(lifecycle.currentReconcileToken()).toBeGreaterThan(token);
  });
});
