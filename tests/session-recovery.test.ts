import { describe, expect, it } from 'vitest';
import {
  matchesExpectedNativeEvent,
  matchesExpectedNativeSession,
  migrateNativeSessionMetadata,
  requiresLegacyPopupRestore,
  selectRecoveredSessionTab,
} from '../src/shared/session-recovery';

const nonce = '0123456789abcdef0123456789abcdef';

describe('native session recovery', () => {
  it('prefers the exact 128-bit title marker', () => {
    expect(selectRecoveredSessionTab([
      { id: 1, windowId: 1, title: 'Normal tab', url: 'https://example.test/' },
      { id: 2, windowId: 2, title: `[AniWebScale:${nonce}] Player`, url: 'https://video.test/' },
    ], nonce)?.id).toBe(2);
  });

  it('rejects a popup URL without the nonce title marker', () => {
    expect(selectRecoveredSessionTab([
      { id: 3, windowId: 3, windowType: 'popup', url: 'https://video.test/' },
    ], nonce)).toBeNull();
  });

  it('rejects ambiguous title and URL matches', () => {
    const title = `[AniWebScale:${nonce}] Player`;
    expect(selectRecoveredSessionTab([
      { id: 1, windowId: 1, title },
      { id: 2, windowId: 2, title },
    ], nonce)).toBeNull();
    expect(selectRecoveredSessionTab([
      { id: 3, windowId: 3, windowType: 'popup', url: 'https://video.test/' },
      { id: 4, windowId: 4, windowType: 'popup', url: 'https://video.test/' },
    ], nonce)).toBeNull();
  });

  it('restores tab placement only for legacy v1 popup sessions', () => {
    expect(requiresLegacyPopupRestore({ version: 1 })).toBe(true);
    expect(requiresLegacyPopupRestore({ version: 3, captureKind: 'legacy-popup' })).toBe(true);
    expect(requiresLegacyPopupRestore({ version: 2, captureKind: 'direct-fullscreen' })).toBe(false);
  });

  it('migrates v1/v2 metadata to v3 without losing its capture layout', () => {
    expect(migrateNativeSessionMetadata({ version: 1 })).toEqual({
      version: 3,
      captureKind: 'legacy-popup',
    });
    expect(migrateNativeSessionMetadata({ version: 2, captureKind: 'direct-fullscreen' })).toEqual({
      version: 3,
      captureKind: 'direct-fullscreen',
    });
    expect(migrateNativeSessionMetadata({ version: 99 })).toBeNull();
  });

  it('rejects delayed cleanup from a replaced native session', () => {
    const current = { sessionId: 'new-session' };
    expect(matchesExpectedNativeSession(current, 'old-session')).toBe(false);
    expect(matchesExpectedNativeSession(current, 'new-session')).toBe(true);
    expect(matchesExpectedNativeSession(current)).toBe(true);
    expect(matchesExpectedNativeSession(null, 'old-session')).toBe(false);
  });

  it('rejects unscoped and delayed content-side native events', () => {
    expect(matchesExpectedNativeEvent('new-session', 'old-session')).toBe(false);
    expect(matchesExpectedNativeEvent('new-session', undefined)).toBe(false);
    expect(matchesExpectedNativeEvent(null, 'new-session')).toBe(false);
    expect(matchesExpectedNativeEvent('new-session', 'new-session')).toBe(true);
  });
});
