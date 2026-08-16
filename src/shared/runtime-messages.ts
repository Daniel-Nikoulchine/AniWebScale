import {
  isNativeConfiguration,
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

export interface NativePointerRequest {
  type: 'NATIVE_POINTER';
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

export interface NativeResetConsentRequest {
  type: 'NATIVE_RESET_CONSENT';
  origin?: string;
}

export interface SettingsUpdatedRequest {
  type: 'SETTINGS_UPDATED';
  settings?: unknown;
  modifiedModeId?: string;
}

export interface SiteAccessSyncRequest {
  type: 'SITE_ACCESS_SYNC';
}

export interface OpenOptionsPageRequest {
  type: 'OPEN_OPTIONS_PAGE';
}

export interface OpenOnboardingRequest {
  type: 'OPEN_ONBOARDING';
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
  | OpenOptionsPageRequest
  | OpenOnboardingRequest;

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
      if (origin !== undefined && !isHttpOrigin(origin)) return { kind: 'message', message: { type } };
      return { kind: 'message', message: { type, origin } };
    }
    case 'SETTINGS_UPDATED':
      return {
        kind: 'message',
        message: {
          type,
          settings: value.settings,
          modifiedModeId: asString(value.modifiedModeId),
        },
      };
    case 'SITE_ACCESS_SYNC':
      return { kind: 'message', message: { type } };
    case 'OPEN_OPTIONS_PAGE':
      return { kind: 'message', message: { type } };
    case 'OPEN_ONBOARDING':
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

export interface NativePrepareSessionMessage {
  type: 'NATIVE_PREPARE_SESSION';
  sessionId: string;
  nonce: string;
  videoId?: string;
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

export interface NativeMeasurePopupMessage {
  type: 'NATIVE_MEASURE_POPUP';
}

export interface NativePrepareTopFrameMessage {
  type: 'NATIVE_PREPARE_TOP_FRAME';
  sessionId: string;
  nonce: string;
  sourceUrl?: string;
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

export interface NativePointerEventMessage {
  type: 'NATIVE_POINTER_EVENT';
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

export interface NativeMediaCommandEventMessage {
  type: 'NATIVE_MEDIA_COMMAND_EVENT';
  command: string;
  value?: number;
}

export interface NativeSessionEventMessage {
  type: 'NATIVE_SESSION_EVENT';
  event?: NativeEvent;
}

export type FrameMessage =
  | Anime4kForceStopMessage
  | UrlUpdatedMessage
  | NativeConsentRequestMessage
  | NativePrepareSessionMessage
  | NativePrepareFullscreenMessage
  | NativeMeasureFullscreenMessage
  | NativeMeasurePopupMessage
  | NativePrepareTopFrameMessage
  | NativeSetTitleNonceMessage
  | NativeRestoreSessionMessage
  | NativeRestoreTitleMessage
  | NativePointerEventMessage
  | NativeMediaCommandEventMessage
  | NativeSessionEventMessage;

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
    case 'ANIME4K_FORCE_STOP':
      return { kind: 'message', message: { type, videoId: asString(value.videoId) ?? '' } };
    case 'URL_UPDATED':
      return { kind: 'message', message: { type, url: asString(value.url) } };
    case 'NATIVE_CONSENT_REQUEST':
      return { kind: 'message', message: { type, origin: asString(value.origin) } };
    case 'NATIVE_PREPARE_SESSION':
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
    case 'NATIVE_MEASURE_POPUP':
      return { kind: 'message', message: { type } };
    case 'NATIVE_PREPARE_TOP_FRAME': {
      const sessionId = asString(value.sessionId);
      const nonce = asString(value.nonce);
      if (sessionId === undefined || nonce === undefined) {
        return frameInvalid(type, 'Invalid native session.');
      }
      return { kind: 'message', message: { type, sessionId, nonce, sourceUrl: asString(value.sourceUrl) } };
    }
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
      return {
        kind: 'message',
        message: {
          type,
          event: String(value.event ?? ''),
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
      };
    case 'NATIVE_MEDIA_COMMAND_EVENT':
      return {
        kind: 'message',
        message: {
          type,
          command: String(value.command ?? ''),
          value: asFiniteNumber(value.value),
        },
      };
    case 'NATIVE_SESSION_EVENT':
      return { kind: 'message', message: { type, event: value.event as NativeEvent | undefined } };
    default:
      return { kind: 'unknown' };
  }
}

// ── Response forms ───────────────────────────────────────────────────────

/** The common outcome envelope used across the seam. */
export interface OkResponse {
  ok: boolean;
  message?: string;
}

export interface ClaimResponse extends OkResponse {
  alreadyStopped?: boolean;
}

export interface NativeFallbackResponse extends OkResponse {
  status?: 'started' | 'unavailable' | 'denied';
  sessionId?: string;
}

export interface SettingsUpdateResponse {
  ok?: boolean;
  status?: string;
  message?: string;
}

export interface NativeStatusResponse extends OkResponse {
  active?: boolean;
  sessionId?: string;
  state?: string;
  message?: string;
}
