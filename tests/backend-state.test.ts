import { describe, expect, it } from 'vitest';
import { BackendState } from '../src/core/backend-state';

describe('BackendState', () => {
  it('starts idle and not busy', () => {
    const state = new BackendState();
    expect(state.phaseName).toBe('idle');
    expect(state.isBusy).toBe(false);
    expect(state.isActive).toBe(false);
    expect(state.isNativeActive).toBe(false);
    expect(state.isWebGPUActive).toBe(false);
  });

  it('beginTransition marks starting and returns a fresh revision', () => {
    const state = new BackendState();
    const revision = state.beginTransition();
    expect(state.phaseName).toBe('starting');
    expect(state.isBusy).toBe(true);
    expect(state.isTransitionCurrent(revision)).toBe(true);
    expect(state.isTransitionCurrent(revision + 1)).toBe(false);
  });

  it('a superseding transition invalidates the previous revision', () => {
    const state = new BackendState();
    const first = state.beginTransition();
    const second = state.beginTransition();
    expect(state.isTransitionCurrent(first)).toBe(false);
    expect(state.isTransitionCurrent(second)).toBe(true);
  });

  it('commits to webgpu-active and native-active phases', () => {
    const state = new BackendState();
    state.beginTransition();
    state.markWebGPUActive();
    expect(state.isWebGPUActive).toBe(true);
    expect(state.isActive).toBe(true);
    expect(state.isNativeActive).toBe(false);

    state.beginTransition();
    state.markNativeActive();
    expect(state.isNativeActive).toBe(true);
    expect(state.isWebGPUActive).toBe(false);
    expect(state.isActive).toBe(true);
  });

  it('markIdle returns to idle', () => {
    const state = new BackendState();
    state.beginTransition();
    state.markNativeActive();
    state.markIdle();
    expect(state.phaseName).toBe('idle');
    expect(state.isBusy).toBe(false);
  });

  it('destroy invalidates all transitions', () => {
    const state = new BackendState();
    const revision = state.beginTransition();
    state.destroy();
    expect(state.isTransitionCurrent(revision)).toBe(false);
    expect(state.isBusy).toBe(false);
  });

  it('markIdle does not clear the revision so stop-then-start still works', () => {
    const state = new BackendState();
    const start = state.beginTransition();
    state.markWebGPUActive();
    state.markIdle();
    // A subsequent start bumps the revision again.
    const restart = state.beginTransition();
    expect(restart).toBeGreaterThan(start);
    expect(state.isTransitionCurrent(start)).toBe(false);
    expect(state.isTransitionCurrent(restart)).toBe(true);
  });
});
