/**
 * pipeline-loader RealESRGAN degradation: stage failures (ORT import,
 * model assets, runner resolution) must resolve a degraded pipeline class
 * — prime + fallback chain — instead of rejecting and killing enhancement.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('onnxruntime-web', () => {
  throw new Error('ORT unavailable in this environment');
});

describe('pipeline-loader RealESRGAN degradation', () => {
  it('resolves a pipeline class when the ORT runtime cannot load', async () => {
    const { loadPipelineConstructor } = await import('../src/core/pipeline-loader');
    const Constructor = await loadPipelineConstructor('RealEsrganX4');
    expect(typeof Constructor).toBe('function');
  });

  it('returns null for unknown classes without throwing', async () => {
    const { loadPipelineConstructor } = await import('../src/core/pipeline-loader');
    await expect(loadPipelineConstructor('NoSuchKernel')).resolves.toBeNull();
  });
});
