/**
 * Session cascade planning: the fastest-first fallback ladder and its
 * duplicate collapsing (a conservative single-threaded config must probe
 * once per EP set, not four times).
 */
import { describe, expect, it } from 'vitest';
import { buildCascadeLevels } from '../src/core/realesrgan-session';

describe('buildCascadeLevels', () => {
  it('orders fastest-first for a multithreaded config', () => {
    expect(buildCascadeLevels(8)).toEqual([
      { numThreads: 8, executionProviders: ['webgpu', 'wasm'] },
      { numThreads: 1, executionProviders: ['webgpu', 'wasm'] },
      { numThreads: 8, executionProviders: ['wasm'] },
      { numThreads: 1, executionProviders: ['wasm'] },
    ]);
  });

  it('collapses duplicate levels when already single-threaded', () => {
    expect(buildCascadeLevels(1)).toEqual([
      { numThreads: 1, executionProviders: ['webgpu', 'wasm'] },
      { numThreads: 1, executionProviders: ['wasm'] },
    ]);
  });
});
