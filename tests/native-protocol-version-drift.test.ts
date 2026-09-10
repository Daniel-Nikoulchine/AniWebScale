/**
 * Native protocol-version drift guard: the TS client validates every host
 * event against NATIVE_PROTOCOL_VERSION, while both native hosts echo the
 * shared C++ constant. If the two drift, a compatible host looks like a
 * protocol error (or an incompatible one looks valid), so the shared header
 * (native/include/anime4k/protocol_version.hpp) and the TS constant must
 * stay in lockstep.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_PROTOCOL_VERSION } from '../src/native/protocol';

describe('native protocol version drift', () => {
  it('matches native/include/anime4k/protocol_version.hpp', () => {
    const header = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../native/include/anime4k/protocol_version.hpp'),
      'utf8',
    );
    const match = header.match(/kProtocolVersion\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(NATIVE_PROTOCOL_VERSION);
  });

  it('the Windows protocol header re-exports the shared constant', () => {
    const header = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../native/include/anime4k/protocol.hpp'),
      'utf8',
    );
    expect(header).toContain('anime4k/protocol_version.hpp');
    // No independent literal: the version must come from the shared header.
    expect(header).not.toMatch(/kProtocolVersion\s*=\s*\d+/);
  });
});
