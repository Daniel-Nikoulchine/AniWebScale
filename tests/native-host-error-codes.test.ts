/**
 * Native-host error-code drift guard: the Linux host emits these codes on the
 * framed JSON replies (and in HTTP error text), and the TS client treats them
 * as an opaque taxonomy. The C++ literals live in
 * native/include/anime4k/native_error_codes.hpp; the TS mirror is
 * NATIVE_HOST_ERROR_CODES. Parse the header and assert the two sets match so a
 * renamed/added code cannot silently diverge on one side only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_HOST_ERROR_CODES } from '../src/shared/realesrgan-error-codes';

function headerCodes(): string[] {
  const header = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../native/include/anime4k/native_error_codes.hpp'),
    'utf8',
  );
  // Every code is declared as an inline constexpr char array literal.
  const matches = [...header.matchAll(/inline constexpr char\s+\w+\[\]\s*=\s*"([a-z0-9_]+)"/g)].map(match => match[1]!);
  return [...new Set(matches)].sort();
}

describe('native host error-code drift', () => {
  it('matches native/include/anime4k/native_error_codes.hpp exactly', () => {
    const expected = Object.values(NATIVE_HOST_ERROR_CODES).sort();
    expect(headerCodes()).toEqual(expected);
  });

  it('covers the transport and protocol verdicts the host emits', () => {
    const values = new Set<string>(Object.values(NATIVE_HOST_ERROR_CODES));
    for (const code of [
      'invalid_json',
      'unknown_type',
      'message_too_large',
      'invalid_request',
      'invalid_data',
      'inference_failed',
      'dma_buf_unsupported',
      'shm_path_rejected',
      'shm_open_failed',
      'shm_read_failed',
      'shm_write_failed',
      'shm_write_incomplete',
    ]) {
      expect(values.has(code)).toBe(true);
    }
  });
});
