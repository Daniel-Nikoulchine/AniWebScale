/**
 * Native MAX_FRAME_DIM drift guard: the TS constant the size guard reads must
 * match the transport header. A silent mismatch either sends the host frames
 * it will reject (burying the runner) or unnecessarily falls back to the
 * session for frames the host could serve.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REALESRGAN_NATIVE_MAX_FRAME_DIM } from '../src/core/realesrgan-native-vulkan-client';

describe('native MAX_FRAME_DIM drift', () => {
  it('matches native/linux-host/http-transport.h', () => {
    const header = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../native/linux-host/http-transport.h'),
      'utf8',
    );
    const match = header.match(/MAX_FRAME_DIM\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(REALESRGAN_NATIVE_MAX_FRAME_DIM);
  });
});
