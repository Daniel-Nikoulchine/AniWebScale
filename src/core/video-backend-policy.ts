import type { SelectedBackend } from '../shared/backend-selection';
import type { NativeFallbackReason } from '../shared/native-fallback-request';

export function assertBackendCompatibility(selectedBackend: SelectedBackend): void {
  if (selectedBackend !== 'unavailable') return;
  throw new Error('WebGPU is unavailable and Backend is forced to WebGPU. Select Auto or Native instead.');
}

export function classifyFallbackReason(error: unknown): NativeFallbackReason {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.name === 'SecurityError' || /cross-origin|tainted|protected content/i.test(current.message)) {
      return 'security-error';
    }
    if (/WebGPU|adapter|kernel is unavailable/i.test(current.message)) return 'webgpu-unavailable';
    current = (current as Error & { cause?: unknown }).cause;
  }
  return 'video-frame-import-failed';
}
