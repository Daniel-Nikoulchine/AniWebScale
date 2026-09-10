import { describe, expect, it } from 'vitest';
import { BackendState } from '../src/core/backend-state';

describe('BackendState', () => {
  it('starts idle and not busy', () => {
    const state = new BackendState();
    expect(state.isBusy).toBe(false);
    expect(state.isStarting).toBe(false);
    expect(state.isActive).toBe(false);
    expect(state.isNativeActive).toBe(false);
    expect(state.isWebGPUActive).toBe(false);
  });

  it('beginTransition marks the backend as starting', () => {
    const state = new BackendState();
    state.beginTransition();
    expect(state.isStarting).toBe(true);
    expect(state.isBusy).toBe(true);
  });

  it('beginTransition does not own lifecycle revisions', () => {
    const state = new BackendState();
    state.beginTransition();
    state.beginTransition();
    expect(state.isStarting).toBe(true);
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
    expect(state.isBusy).toBe(false);
    expect(state.isStarting).toBe(false);
  });

  it('destroy returns the backend to idle', () => {
    const state = new BackendState();
    state.beginTransition();
    state.destroy();
    expect(state.isBusy).toBe(false);
  });

  it('markIdle allows a later transition to start', () => {
    const state = new BackendState();
    state.beginTransition();
    state.markWebGPUActive();
    state.markIdle();
    state.beginTransition();
    expect(state.isStarting).toBe(true);
    expect(state.isBusy).toBe(true);
  });
});
