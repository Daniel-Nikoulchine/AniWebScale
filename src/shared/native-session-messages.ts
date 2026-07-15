export interface NativeSessionIdentity {
  sessionId: string;
  tabId: number;
  frameId: number;
  videoId: string;
}

export interface NativeMessageSenderIdentity {
  tabId?: number;
  frameId?: number;
}

export interface NativeSessionControlMessage {
  sessionId?: unknown;
  videoId?: unknown;
}

export interface NativeMessageOriginSource {
  origin?: string;
  url?: string;
  tabUrl?: string;
}

export function parseNativeConsentResponse(value: unknown): boolean | null {
  if (!value || typeof value !== 'object') return null;
  const allowed = (value as { allowed?: unknown }).allowed;
  return typeof allowed === 'boolean' ? allowed : null;
}

export function parseHttpOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function isHttpOrigin(value: unknown): value is string {
  return typeof value === 'string' && parseHttpOrigin(value) === value;
}

/**
 * MessageSender.origin is authoritative when present. In inherited about:blank
 * frames it carries the effective HTTPS origin even though sender.url does not;
 * for sandboxed opaque frames it is "null" and must not fall back to the tab.
 */
export function resolveNativeMessageOrigin(source: NativeMessageOriginSource): string | null {
  if (source.origin !== undefined) return parseHttpOrigin(source.origin);
  if (source.url !== undefined) return parseHttpOrigin(source.url);
  return parseHttpOrigin(source.tabUrl);
}

/**
 * Destructive/configuration messages must belong to the active session. A
 * session-id message may originate from the source or top frame (pagehide and
 * title restoration live in both); video-id messages belong to the source
 * frame only.
 */
export function isNativeSessionControlAuthorized(
  session: NativeSessionIdentity,
  message: NativeSessionControlMessage,
  sender: NativeMessageSenderIdentity,
): boolean {
  if (sender.tabId !== session.tabId) return false;

  const hasSessionId = typeof message.sessionId === 'string';
  const hasVideoId = typeof message.videoId === 'string';
  if (!hasSessionId && !hasVideoId) return false;

  const frameId = sender.frameId ?? 0;
  if (message.sessionId !== undefined) {
    if (!hasSessionId || message.sessionId !== session.sessionId) return false;
    if (frameId !== 0 && frameId !== session.frameId) return false;
  }
  if (message.videoId !== undefined) {
    if (!hasVideoId || message.videoId !== session.videoId || frameId !== session.frameId) return false;
  }
  return true;
}

/** Playback heartbeats are periodic and can outlive the content-side timer
 * that created them. Require both the exact session and source video so a
 * delayed heartbeat cannot be relabeled as a replacement session. */
export function isNativePlaybackStateAuthorized(
  session: NativeSessionIdentity,
  message: NativeSessionControlMessage,
  sender: NativeMessageSenderIdentity,
): boolean {
  return typeof message.sessionId === 'string'
    && typeof message.videoId === 'string'
    && isNativeSessionControlAuthorized(session, message, sender);
}
