import { describe, expect, it } from 'vitest';
import { assertBackendCompatibility, classifyFallbackReason } from '../src/core/video-backend-policy';

describe('video backend policy', () => {
  it('rejects only an unavailable forced backend', () => {
    expect(() => assertBackendCompatibility('unavailable')).toThrow(/WebGPU is unavailable/);
    expect(() => assertBackendCompatibility('webgpu')).not.toThrow();
    expect(() => assertBackendCompatibility('native')).not.toThrow();
  });

  it('classifies security and WebGPU failures for fallback handling', () => {
    expect(classifyFallbackReason(new DOMException('cross-origin frame', 'SecurityError'))).toBe('security-error');
    expect(classifyFallbackReason(new Error('WebGPU adapter was lost'))).toBe('webgpu-unavailable');
    expect(classifyFallbackReason(new Error('video import failed'))).toBe('video-frame-import-failed');
  });
});
