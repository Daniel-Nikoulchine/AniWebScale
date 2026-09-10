/**
 * Browser runtime factory: construction from injected primitives (no chrome.*,
 * no ORT import) and the auto-selected execution policy.
 */
import { describe, expect, it } from 'vitest';
import { createRealEsrganBrowserSession } from '../src/core/realesrgan-browser-setup';

describe('createRealEsrganBrowserSession', () => {
  it('builds a session factory with the auto precision policy', () => {
    const factory = createRealEsrganBrowserSession({
      resolveModelUrl: fileName => `ext://${fileName}`,
      modelAssetExists: async () => false,
      cores: 32,
    });
    expect(factory.execution).toEqual({ preferFloat16: false, preferInt8: true });
  });

  it('does not require chrome or a navigator', () => {
    const factory = createRealEsrganBrowserSession({
      resolveModelUrl: fileName => fileName,
      modelAssetExists: async () => false,
      cores: 1,
    });
    expect(factory).toBeDefined();
  });
});
