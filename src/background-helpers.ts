/**
 * Small stateless helpers used by the background service worker's native
 * messaging path. Extracted from background.ts so they can be unit-tested in
 * isolation. None of these touch module-level session state.
 */
import { createRequestId } from './native/client';
import { NATIVE_PROTOCOL_VERSION } from './native/protocol';
import {
  parseHttpOrigin,
  resolveNativeMessageOrigin,
} from './shared/native-session-messages';

/** Generate a 16-byte hex nonce used to mark a capture window for the host. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve the effective HTTP(S) origin of a runtime message sender.
 * MessageSender.origin is authoritative for inherited about:blank/srcdoc frames.
 */
export function sourceOrigin(sender: chrome.runtime.MessageSender): string | null {
  return resolveNativeMessageOrigin({
    origin: sender.origin,
    url: sender.url,
    tabUrl: sender.tab?.url,
  });
}

/** The user-visible top-level website origin for a message sender, if any. */
export function topLevelOrigin(sender: chrome.runtime.MessageSender): string | null {
  return parseHttpOrigin(sender.tab?.url);
}

/** Base envelope fields required on every native protocol request. */
export function nativeRequestBase(): {
  protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
  requestId: string;
} {
  return { protocolVersion: NATIVE_PROTOCOL_VERSION, requestId: createRequestId() };
}
