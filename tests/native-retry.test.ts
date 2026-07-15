import { describe, expect, it } from 'vitest';
import { blocksNativeRetry } from '../src/shared/native-retry';

describe('native retry policy', () => {
  it('blocks a retry after protected capture is detected', () => {
    expect(blocksNativeRetry({
      type: 'error',
      code: 'protected_capture_blocked',
      message: 'The browser delivered only black frames.',
    })).toBe(true);
    expect(blocksNativeRetry({ type: 'stopped', reason: 'protected_content' })).toBe(true);
  });

  it('keeps transient capture-close recovery available', () => {
    expect(blocksNativeRetry({ type: 'stopped', reason: 'capture_window_closed' })).toBe(false);
    expect(blocksNativeRetry({ type: 'error', code: 'device_lost' })).toBe(false);
    expect(blocksNativeRetry(null)).toBe(false);
  });
});
