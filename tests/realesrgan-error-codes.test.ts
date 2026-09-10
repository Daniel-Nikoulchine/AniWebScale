/**
 * Failure taxonomy: code format stability, uniqueness and the fatal set.
 * Producers log `[RealESRGAN:{code}]` ahead of unchanged human text, so
 * console debugging reads the same while the verdict matches codes.
 */
import { describe, expect, it } from 'vitest';
import {
  formatRealEsrganError,
  REALESRGAN_ERROR_CODES,
  REALESRGAN_FATAL_ERROR_CODES,
  REALESRGAN_TRANSIENT_ERROR_CODES,
} from '../src/shared/realesrgan-error-codes';

describe('failure taxonomy', () => {
  it('codes are unique kebab slugs', () => {
    const codes = Object.values(REALESRGAN_ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z0-9-]+$/);
  });

  it('formats the machine prefix ahead of human text', () => {
    expect(formatRealEsrganError('infer-retry', 'boom')).toBe('[RealESRGAN:infer-retry] boom');
  });

  it('fatal set holds exactly the no-recovery codes', () => {
    expect([...REALESRGAN_FATAL_ERROR_CODES].sort()).toEqual(
      ['session-create-failed', 'worker-failed', 'worker-init-timeout', 'worker-spawn-failed'].sort(),
    );
  });

  it('transient set holds exactly the retry-budget codes', () => {
    expect([...REALESRGAN_TRANSIENT_ERROR_CODES].sort()).toEqual(
      [
        'infer-retry',
        'native-frame-failed',
        'native-frame-timeout',
        'native-handshake-timeout',
        'worker-timeout',
      ].sort(),
    );
  });

  it('fatal and transient sets do not overlap', () => {
    const fatal = new Set(REALESRGAN_FATAL_ERROR_CODES);
    for (const code of REALESRGAN_TRANSIENT_ERROR_CODES) expect(fatal.has(code)).toBe(false);
  });
});
