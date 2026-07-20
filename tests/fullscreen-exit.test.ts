import { describe, expect, it } from 'vitest';
import { resolveFullscreenExitState } from '../src/shared/fullscreen-exit';

describe('native fullscreen exit confirmation', () => {
  it('uses the top frame as the authoritative fullscreen state', () => {
    expect(resolveFullscreenExitState(
      { ok: true, fullscreenActive: false },
      { ok: true, fullscreenActive: true },
    )).toBe('exited');
  });

  it('falls back to the source frame when the top frame is unavailable', () => {
    expect(resolveFullscreenExitState(null, { ok: true, fullscreenActive: false })).toBe('exited');
    expect(resolveFullscreenExitState(null, { ok: true, fullscreenActive: true })).toBe('active');
  });

  it('does not close the renderer on an unconfirmed response', () => {
    expect(resolveFullscreenExitState(null, null)).toBe('unknown');
    expect(resolveFullscreenExitState({ ok: false }, { ok: true })).toBe('unknown');
  });
});
