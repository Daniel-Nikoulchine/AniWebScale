import {
  isNativeConfiguration,
  isNativeEvent,
  isNativeMediaCommandName,
  isNativePointerEventPayload,
  type NativeConfiguration,
  type NativeMediaCommandName,
} from '../native/protocol';
import {
  isNativeFallbackRequest,
  type NativeFallbackRequest,
} from './native-fallback-request';
import { isHttpOrigin } from './native-session-messages';
import type { NativeEvent } from '../native/protocol';

/**
 * The typed protocol for the extension's runtime message seam.
 *
 * Two directions cross this seam:
 * - RuntimeRequest: content scripts and UI pages → background service worker
 *   (chrome.runtime.sendMessage).
 * - FrameMessage: background → a content-script frame
 *   (chrome.tabs.sendMessage).
 *
 * Every message name, payload shape and response form lives here, so both
 * sides import one module instead of re-deriving field checks ad hoc. The
 * guards preserve the exact validation the handlers performed before: a
 * message that fails its guard is rejected the same way it was rejected
 * before, only now the rejection happens at the seam instead of inside each
 * case branch.
 */

// ── RuntimeRequest: content/UI → background ──────────────────────────────

export interface EnhancementClaimRequest {
  type: 'ENHANCEMENT_CLAIM';
  videoId: string;
}

export interface EnhancementReleaseRequest {
  type: 'ENHANCEMENT_RELEASE';
  videoId?: string;
}

export interface NativeUpdateConfigurationRequest {
  type: 'NATIVE_UPDATE_CONFIGURATION';
  sessionId?: string;
  videoId?: string;
  configuration: NativeConfiguration;
}

export interface NativeStopRequest {
  type: 'NATIVE_STOP';
  sessionId?: string;
  videoId?: string;
}

export interface NativeStatusRequest {
  type: 'NATIVE_STATUS';
}

export interface NativePlaybackStateRequest {
  type: 'NATIVE_PLAYBACK_STATE';
  sessionId: string;
  videoId: string;
  playbackActive: boolean;
  mediaTime: number;
}

export interface NativeMediaCommandRequest {
  type: 'NATIVE_MEDIA_COMMAND';
  command: NativeMediaCommandName;
  value?: number;
}

/** The pointer payload as it crosses the seam in both directions. */
export interface NativePointerPayload {
  event: string;
  x: number;
  y: number;
  button?: number;
  buttons?: number;
  deltaX?: number;
  deltaY?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

export interface NativePointerRequest extends NativePointerPayload {
  type: 'NATIVE_POINTER';
}

export interface NativeResetConsentRequest {
  type: 'NATIVE_RESET_CONSENT';
  origin?: string;
}

export interface SettingsUpdatedRequest {
  type: 'SETTINGS_UPDATED';
}

export interface SiteAccessSyncRequest {
  type: 'SITE_ACCESS_SYNC';
}

/**
 * Sent by a content script when a cross-origin player iframe enters
 * fullscreen. The background decides whether the player origin already has
 * site access ('injected'), a permission prompt is on its way ('prompting'),
 * or a recent prompt makes this request redundant ('suppressed').
 */
export interface SiteAccessIframeRequest {
  type: 'SITE_ACCESS_IFRAME_REQUEST';
  origin: string;
}

export interface OpenOptionsPageRequest {
  type: 'OPEN_OPTIONS_PAGE';
}

export interface OpenOnboardingRequest {
  type: 'OPEN_ONBOARDING';
}

/**
 * Content scripts cannot call chrome.runtime.connectNative (background-only),
 * so the renderer asks the background for the ncnn host's loopback HTTP
 * transport (port + per-process bearer token) instead. The background owns
 * the native-messaging port as the host's lifeline and hands out the
 * endpoint; frame payloads then cross the loopback socket as raw binary.
 */
export interface RealEsrganHttpInfoRequest {
  type: 'REALESRGAN_HTTP_INFO';
}

export type RuntimeRequest =
  | EnhancementClaimRequest
  | EnhancementReleaseRequest
  | NativeFallbackRequest
  | NativeUpdateConfigurationRequest
  | NativeStopRequest
  | NativeStatusRequest
  | NativePlaybackStateRequest
  | NativeMediaCommandRequest
  | NativePointerRequest
  | NativeResetConsentRequest
  | SettingsUpdatedRequest
  | SiteAccessSyncRequest
  | SiteAccessIframeRequest
  | OpenOptionsPageRequest
  | OpenOnboardingRequest
  | RealEsrganHttpInfoRequest;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The outcome of parsing an incoming runtime message:
 * - `message`: a well-formed typed message.
 * - `invalid`: a known message type with a malformed payload; `message` is
 *   the exact rejection text the handler answered before the protocol existed.
 * - `unknown`: not a runtime message type at all.
 */
export type RuntimeRequestParseResult =
  | { kind: 'message'; message: RuntimeRequest }
  | { kind: 'invalid'; type: string; message: string; status?: 'denied' }
  | { kind: 'unknown' };

function invalid(type: string, message: string, status?: 'denied'): RuntimeRequestParseResult {
  return { kind: 'invalid', type, message, ...(status ? { status } : {}) };
}

/**
 * Parse an incoming runtime message. Security-relevant messages validate
 * their full shape here so the handler switch can rely on the typed result;
 * rejection texts match the pre-protocol handler behaviour exactly.
 */
export function parseRuntimeRequest(value: unknown): RuntimeRequestParseResult {
  if (!isRecord(value)) return { kind: 'unknown' };
  const type = value.type;

  switch (type) {
    case 'ENHANCEMENT_CLAIM': {
      const videoId = asString(value.videoId);
      return videoId !== undefined
        ? { kind: 'message', message: { type, videoId } }
        : invalid(type, 'Missing video ID.');
    }
    case 'ENHANCEMENT_RELEASE':
      // A release without a video ID is answered ok without releasing; the
      // handler decides, so the payload stays optional here.
      return {
        kind: 'message',
        message: { type, videoId: asString(value.videoId) },
      };
    case 'NATIVE_FALLBACK_REQUEST':
      return isNativeFallbackRequest(value)
        ? { kind: 'message', message: value }
        : invalid(type, 'The native fallback request was invalid.', 'denied');
    case 'NATIVE_UPDATE_CONFIGURATION': {
      // Older senders flatten mode/quality onto the message itself.
      const configuration = isRecord(value.configuration)
        ? value.configuration
        : {
            mode: value.mode,
            quality: value.quality,
            frameGenerationEnabled: value.frameGenerationEnabled,
          };
      if (!isNativeConfiguration(configuration)) {
        return invalid(type, 'Invalid native enhancement configuration.');
      }
      return {
        kind: 'message',
        message: {
          type,
          sessionId: asString(value.sessionId),
          videoId: asString(value.videoId),
          configuration,
        },
      };
    }
    case 'NATIVE_STOP':
      return {
        kind: 'message',
        message: {
          type,
          sessionId: asString(value.sessionId),
          videoId: asString(value.videoId),
        },
      };
    case 'NATIVE_STATUS':
      return { kind: 'message', message: { type } };
    case 'NATIVE_PLAYBACK_STATE': {
      const sessionId = asString(value.sessionId);
      const videoId = asString(value.videoId);
      const playbackActive = typeof value.playbackActive === 'boolean' ? value.playbackActive : undefined;
      const mediaTime = asFiniteNumber(value.mediaTime);
      if (sessionId === undefined || videoId === undefined
          || playbackActive === undefined || mediaTime === undefined || mediaTime < 0) {
        return invalid(type, 'Invalid native playback state.');
      }
      return {
        kind: 'message',
        message: { type, sessionId, videoId, playbackActive, mediaTime },
      };
    }
    case 'NATIVE_MEDIA_COMMAND': {
      if (!isNativeMediaCommandName(value.command)) return invalid(type, 'Invalid media command.');
      return {
        kind: 'message',
        message: {
          type,
          command: value.command,
          value: asFiniteNumber(value.value),
        },
      };
    }
    case 'NATIVE_POINTER':
      return isNativePointerEventPayload(value)
        ? {
            kind: 'message',
            message: {
              type,
              event: String(value.event),
              x: Number(value.x),
              y: Number(value.y),
              button: asFiniteNumber(value.button),
              buttons: asFiniteNumber(value.buttons),
              deltaX: asFiniteNumber(value.deltaX),
              deltaY: asFiniteNumber(value.deltaY),
              shiftKey: typeof value.shiftKey === 'boolean' ? value.shiftKey : undefined,
              ctrlKey: typeof value.ctrlKey === 'boolean' ? value.ctrlKey : undefined,
              altKey: typeof value.altKey === 'boolean' ? value.altKey : undefined,
            },
          }
        : invalid(type, 'Invalid native pointer event.');
    case 'NATIVE_RESET_CONSENT': {
      const origin = asString(value.origin);
      if (origin !== undefined && !isHttpOrigin(origin)) return invalid(type, 'Invalid consent origin.');
      return { kind: 'message', message: { type, origin } };
    }
    case 'SETTINGS_UPDATED':
      return { kind: 'message', message: { type } };
    case 'SITE_ACCESS_SYNC':
      return { kind: 'message', message: { type } };
    case 'SITE_ACCESS_IFRAME_REQUEST': {
      const origin = asString(value.origin);
      return origin !== undefined && isHttpOrigin(origin)
        ? { kind: 'message', message: { type, origin } }
        : invalid(type, 'Invalid player origin.');
    }
    case 'OPEN_OPTIONS_PAGE':
      return { kind: 'message', message: { type } };
    case 'OPEN_ONBOARDING':
      return { kind: 'message', message: { type } };
    case 'REALESRGAN_HTTP_INFO':
      return { kind: 'message', message: { type } };
    default:
      return { kind: 'unknown' };
  }
}

// ── FrameMessage: background → content frame ─────────────────────────────

export interface Anime4kForceStopMessage {
  type: 'ANIME4K_FORCE_STOP';
  videoId: string;
}

export interface UrlUpdatedMessage {
  type: 'URL_UPDATED';
  url?: string;
}

export interface NativeConsentRequestMessage {
  type: 'NATIVE_CONSENT_REQUEST';
  origin?: string;
}

export interface NativePrepareFullscreenMessage {
  type: 'NATIVE_PREPARE_FULLSCREEN';
  sessionId: string;
  nonce: string;
  videoId?: string;
}

export interface NativeMeasureFullscreenMessage {
  type: 'NATIVE_MEASURE_FULLSCREEN';
  sessionId?: string;
  videoId?: string;
}

export interface NativeSetTitleNonceMessage {
  type: 'NATIVE_SET_TITLE_NONCE';
  sessionId: string;
  nonce: string;
  captureKind?: string;
}

export interface NativeRestoreSessionMessage {
  type: 'NATIVE_RESTORE_SESSION';
  sessionId?: string;
  nonce?: string;
  originalTitle?: string;
}

export interface NativeRestoreTitleMessage {
  type: 'NATIVE_RESTORE_TITLE';
  sessionId?: string;
  nonce?: string;
  originalTitle?: string;
}

export interface NativePointerEventMessage extends NativePointerPayload {
  type: 'NATIVE_POINTER_EVENT';
}

export interface NativeMediaCommandEventMessage {
  type: 'NATIVE_MEDIA_COMMAND_EVENT';
  command: string;
  value?: number;
}

export interface NativeSessionEventMessage {
  type: 'NATIVE_SESSION_EVENT';
  event?: NativeEvent;
}

/**
 * The final result of a fullscreen-triggered player access request. Sent to
 * the top frame so the page can explain what happened to the user. `applied`
 * reports whether the scripts were actually injected into the tab for a
 * granted origin; when false, a reload of the player page is required.
 */
export interface SiteAccessResultMessage {
  type: 'SITE_ACCESS_RESULT';
  origin: string;
  outcome: 'granted' | 'denied' | 'failed';
  applied?: boolean;
}

export type FrameMessage =
  | Anime4kForceStopMessage
  | UrlUpdatedMessage
  | NativeConsentRequestMessage
  | NativePrepareFullscreenMessage
  | NativeMeasureFullscreenMessage
  | NativeSetTitleNonceMessage
  | NativeRestoreSessionMessage
  | NativeRestoreTitleMessage
  | NativePointerEventMessage
  | NativeMediaCommandEventMessage
  | NativeSessionEventMessage
  | SiteAccessResultMessage;

/**
 * The outcome of parsing a frame message:
 * - `message`: a well-formed typed message.
 * - `invalid`: a known type with a malformed payload; `message` is the exact
 *   rejection text the content handler answered before the protocol existed.
 * - `unknown`: not a frame message type at all.
 */
export type FrameMessageParseResult =
  | { kind: 'message'; message: FrameMessage }
  | { kind: 'invalid'; type: string; message: string }
  | { kind: 'unknown' };

function frameInvalid(type: string, message: string): FrameMessageParseResult {
  return { kind: 'invalid', type, message };
}

/**
 * Parse a message delivered to a content-script frame. Session preparation
 * messages require their sessionId and nonce; everything else parses on its
 * type name with best-effort field typing.
 */
export function parseFrameMessage(value: unknown): FrameMessageParseResult {
  if (!isRecord(value)) return { kind: 'unknown' };
  const type = value.type;

  switch (type) {
    case 'ANIME4K_FORCE_STOP': {
      const videoId = asString(value.videoId);
      if (videoId === undefined) return frameInvalid(type, 'Force-stop without a video id.');
      return { kind: 'message', message: { type, videoId } };
    }
    case 'URL_UPDATED':
      return { kind: 'message', message: { type, url: asString(value.url) } };
    case 'NATIVE_CONSENT_REQUEST':
      return { kind: 'message', message: { type, origin: asString(value.origin) } };
    case 'NATIVE_PREPARE_FULLSCREEN': {
      const sessionId = asString(value.sessionId);
      const nonce = asString(value.nonce);
      if (sessionId === undefined || nonce === undefined) {
        return frameInvalid(type, 'Invalid native session.');
      }
      return { kind: 'message', message: { type, sessionId, nonce, videoId: asString(value.videoId) } };
    }
    case 'NATIVE_MEASURE_FULLSCREEN':
      return {
        kind: 'message',
        message: { type, sessionId: asString(value.sessionId), videoId: asString(value.videoId) },
      };
    case 'NATIVE_SET_TITLE_NONCE': {
      const sessionId = asString(value.sessionId);
      const nonce = asString(value.nonce);
      if (sessionId === undefined || nonce === undefined) {
        return frameInvalid(type, 'Invalid native session.');
      }
      return { kind: 'message', message: { type, sessionId, nonce, captureKind: asString(value.captureKind) } };
    }
    case 'NATIVE_RESTORE_SESSION':
      return {
        kind: 'message',
        message: {
          type,
          sessionId: asString(value.sessionId),
          nonce: asString(value.nonce),
          originalTitle: asString(value.originalTitle),
        },
      };
    case 'NATIVE_RESTORE_TITLE':
      return {
        kind: 'message',
        message: {
          type,
          sessionId: asString(value.sessionId),
          nonce: asString(value.nonce),
          originalTitle: asString(value.originalTitle),
        },
      };
    case 'NATIVE_POINTER_EVENT':
      // Mirrors the runtime-direction NATIVE_POINTER gate above: coordinates
      // must be finite and normalized, otherwise NaN would flow into the
      // input bridge (whose clamp maps NaN to the video origin — a phantom
      // click) instead of an explicit invalid verdict.
      return isNativePointerEventPayload(value)
        ? {
            kind: 'message',
            message: {
              type,
              event: value.event,
              x: value.x,
              y: value.y,
              button: asFiniteNumber(value.button),
              buttons: asFiniteNumber(value.buttons),
              deltaX: asFiniteNumber(value.deltaX),
              deltaY: asFiniteNumber(value.deltaY),
              shiftKey: typeof value.shiftKey === 'boolean' ? value.shiftKey : undefined,
              ctrlKey: typeof value.ctrlKey === 'boolean' ? value.ctrlKey : undefined,
              altKey: typeof value.altKey === 'boolean' ? value.altKey : undefined,
            },
          }
        : frameInvalid(type, 'Invalid native pointer event.');
    case 'NATIVE_MEDIA_COMMAND_EVENT': {
      if (!isNativeMediaCommandName(value.command)) return frameInvalid(type, 'Invalid media command.');
      return {
        kind: 'message',
        message: {
          type,
          command: value.command,
          value: asFiniteNumber(value.value),
        },
      };
    }
    case 'NATIVE_SESSION_EVENT':
      return { kind: 'message', message: { type, event: isNativeEvent(value.event) ? value.event : undefined } };
    case 'SITE_ACCESS_RESULT': {
      const outcome = value.outcome === 'granted' || value.outcome === 'denied' ? value.outcome : 'failed';
      return {
        kind: 'message',
        message: {
          type,
          origin: asString(value.origin) ?? '',
          outcome,
          ...(typeof value.applied === 'boolean' ? { applied: value.applied } : {}),
        },
      };
    }
    default:
      return { kind: 'unknown' };
  }
}

// ── Senders: the wire form of every message exists exactly once ──────────

export {
  enhancementClaimMessage,
  enhancementReleaseMessage,
  nativeStopMessage,
  nativeUpdateConfigurationMessage,
  nativePlaybackStateMessage,
  nativeFallbackRequestMessage,
  settingsUpdatedMessage,
  siteAccessSyncMessage,
  siteAccessIframeRequestMessage,
  siteAccessResultMessage,
  nativeResetConsentMessage,
  urlUpdatedMessage,
  nativeConsentRequestMessage,
} from './runtime-message-builders';

// ── Response forms ───────────────────────────────────────────────────────

export interface StatusResponse {
  ok: boolean;
  message?: string;
}

/**
 * Interpret a handler's response envelope. Handlers that have nothing to
 * report answer `undefined`; only an explicit `{ ok: false }` counts as a
 * refusal, so an absent envelope resolves as success — the exact contract
 * the per-call-site `as { ok?: boolean }` casts implemented.
 */
export function parseStatusResponse(value: unknown): StatusResponse {
  if (!value || typeof value !== 'object') return { ok: true };
  const record = value as Record<string, unknown>;
  return {
    ok: record.ok !== false,
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
  };
}

export interface SiteAccessIframeResponseValue {
  ok: boolean;
  outcome?: 'injected' | 'prompting' | 'suppressed';
  message?: string;
}

/**
 * Interpret the background's reply to a SITE_ACCESS_IFRAME_REQUEST. The
 * outcome is only trusted when the envelope is explicitly ok, mirroring the
 * status-response contract used by the other content-side call sites.
 */
export function parseSiteAccessIframeResponse(value: unknown): SiteAccessIframeResponseValue {
  if (!value || typeof value !== 'object') return { ok: false };
  const record = value as Record<string, unknown>;
  const outcome = record.outcome;
  return {
    ok: record.ok === true,
    ...(outcome === 'injected' || outcome === 'prompting' || outcome === 'suppressed'
      ? { outcome }
      : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
  };
}

export interface NativeFallbackResponseValue {
  ok: boolean;
  status?: 'started' | 'unavailable' | 'denied';
  message?: string;
  sessionId?: string;
}

export function parseNativeFallbackResponse(value: unknown): NativeFallbackResponseValue {
  if (!value || typeof value !== 'object') return { ok: false };
  const record = value as Record<string, unknown>;
  // Whitelist like parseSiteAccessIframeResponse above: an unknown status
  // must not masquerade as a known outcome downstream.
  const status = record.status === 'started' || record.status === 'unavailable' || record.status === 'denied'
    ? record.status
    : undefined;
  return {
    ok: record.ok === true,
    ...(status !== undefined ? { status } : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
    ...(typeof record.sessionId === 'string' ? { sessionId: record.sessionId } : {}),
  };
}
