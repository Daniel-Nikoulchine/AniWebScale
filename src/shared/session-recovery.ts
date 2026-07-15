export interface RecoverableTab {
  id: number;
  windowId: number;
  title?: string;
  url?: string;
  windowType?: string;
}

export const NATIVE_SESSION_VERSION = 3 as const;
export type NativeCaptureKind = 'direct-fullscreen' | 'legacy-popup';

export function migrateNativeSessionMetadata(session: {
  version?: unknown;
  captureKind?: unknown;
}): { version: typeof NATIVE_SESSION_VERSION; captureKind: NativeCaptureKind } | null {
  if (session.version !== 1 && session.version !== 2 && session.version !== NATIVE_SESSION_VERSION) {
    return null;
  }
  const legacyPopup = session.captureKind === 'legacy-popup'
    || session.version === 1 && session.captureKind !== 'direct-fullscreen';
  return {
    version: NATIVE_SESSION_VERSION,
    captureKind: legacyPopup ? 'legacy-popup' : 'direct-fullscreen',
  };
}

/** Select an orphaned nonce-marked browser tab only when the match is unambiguous. */
export function selectRecoveredSessionTab(
  tabs: readonly RecoverableTab[],
  nonce: string,
): RecoverableTab | null {
  const marker = `[AniWebScale:${nonce}]`;
  const titleMatches = tabs.filter(tab => tab.title?.includes(marker));
  if (titleMatches.length === 1) return titleMatches[0];
  return null;
}

export function requiresLegacyPopupRestore(session: {
  version?: number;
  captureKind?: string;
}): boolean {
  return session.captureKind === 'legacy-popup'
    || session.version === 1 && session.captureKind !== 'direct-fullscreen';
}

/** Guards delayed cleanup so an event from an old session cannot stop its replacement. */
export function matchesExpectedNativeSession(
  session: { sessionId: string } | null,
  expectedSessionId?: string,
): boolean {
  return expectedSessionId === undefined || session?.sessionId === expectedSessionId;
}

/** Rejects delayed renderer events unless they belong to the active content-side session. */
export function matchesExpectedNativeEvent(
  expectedSessionId: string | null,
  eventSessionId: unknown,
): boolean {
  return expectedSessionId !== null
    && typeof eventSessionId === 'string'
    && eventSessionId === expectedSessionId;
}
