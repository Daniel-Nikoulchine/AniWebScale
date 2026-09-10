import type { NativeConfiguration, NativeEvent, NativeMediaCommandName } from '../native/protocol';
import type { NativePointerPayload } from './native-pointer';
import type { NativeFallbackRequest } from './native-fallback-request';
import type {
  Anime4kForceStopMessage,
  EnhancementClaimRequest,
  EnhancementReleaseRequest,
  NativeMediaCommandEventMessage,
  NativeMeasureFullscreenMessage,
  NativePlaybackStateRequest,
  NativePointerEventMessage,
  NativePrepareFullscreenMessage,
  NativeResetConsentRequest,
  NativeRestoreSessionMessage,
  NativeRestoreTitleMessage,
  NativeSessionEventMessage,
  NativeSetTitleNonceMessage,
  NativeStopRequest,
  NativeUpdateConfigurationRequest,
  RealEsrganHttpInfoRequest,
  SettingsUpdatedRequest,
  SiteAccessIframeRequest,
  SiteAccessResultMessage,
  SiteAccessSyncRequest,
  NativeConsentRequestMessage,
} from './runtime-messages';

export function enhancementClaimMessage(videoId: string): EnhancementClaimRequest {
  return { type: 'ENHANCEMENT_CLAIM', videoId };
}

export function enhancementReleaseMessage(videoId?: string): EnhancementReleaseRequest {
  return { type: 'ENHANCEMENT_RELEASE', ...(videoId !== undefined ? { videoId } : {}) };
}

export function nativeStopMessage(ids: { sessionId?: string; videoId?: string } = {}): NativeStopRequest {
  return { type: 'NATIVE_STOP', ...ids };
}

export function nativeUpdateConfigurationMessage(payload: {
  sessionId?: string;
  videoId?: string;
  configuration: NativeConfiguration;
}): NativeUpdateConfigurationRequest {
  return { type: 'NATIVE_UPDATE_CONFIGURATION', ...payload };
}

export function nativePlaybackStateMessage(state: {
  sessionId: string;
  videoId: string;
  playbackActive: boolean;
  mediaTime: number;
}): NativePlaybackStateRequest {
  return { type: 'NATIVE_PLAYBACK_STATE', ...state };
}

export function nativeFallbackRequestMessage(
  request: Omit<NativeFallbackRequest, 'type'>,
): NativeFallbackRequest {
  return { type: 'NATIVE_FALLBACK_REQUEST', ...request };
}

export function settingsUpdatedMessage(): SettingsUpdatedRequest {
  return { type: 'SETTINGS_UPDATED' };
}

export function siteAccessSyncMessage(): SiteAccessSyncRequest {
  return { type: 'SITE_ACCESS_SYNC' };
}

export function siteAccessIframeRequestMessage(origin: string): SiteAccessIframeRequest {
  return { type: 'SITE_ACCESS_IFRAME_REQUEST', origin };
}

export function siteAccessResultMessage(payload: {
  origin: string;
  outcome: 'granted' | 'denied' | 'failed';
  applied?: boolean;
}): SiteAccessResultMessage {
  return { type: 'SITE_ACCESS_RESULT', ...payload };
}

export function nativeResetConsentMessage(origin?: string): NativeResetConsentRequest {
  return { type: 'NATIVE_RESET_CONSENT', ...(origin !== undefined ? { origin } : {}) };
}

export function realEsrganHttpInfoMessage(): RealEsrganHttpInfoRequest {
  return { type: 'REALESRGAN_HTTP_INFO' };
}

export function nativeConsentRequestMessage(origin?: string): NativeConsentRequestMessage {
  return { type: 'NATIVE_CONSENT_REQUEST', ...(origin !== undefined ? { origin } : {}) };
}

export function anime4kForceStopMessage(videoId: string): Anime4kForceStopMessage {
  return { type: 'ANIME4K_FORCE_STOP', videoId };
}

export function nativePrepareFullscreenMessage(payload: {
  sessionId: string;
  nonce: string;
  videoId?: string;
}): NativePrepareFullscreenMessage {
  return { type: 'NATIVE_PREPARE_FULLSCREEN', ...payload };
}

export function nativeMeasureFullscreenMessage(payload: {
  sessionId?: string;
  videoId?: string;
} = {}): NativeMeasureFullscreenMessage {
  return { type: 'NATIVE_MEASURE_FULLSCREEN', ...payload };
}

export function nativeSetTitleNonceMessage(payload: {
  sessionId: string;
  nonce: string;
  captureKind?: string;
}): NativeSetTitleNonceMessage {
  return { type: 'NATIVE_SET_TITLE_NONCE', ...payload };
}

export function nativeRestoreSessionMessage(payload: {
  sessionId?: string;
  nonce?: string;
  originalTitle?: string;
} = {}): NativeRestoreSessionMessage {
  return { type: 'NATIVE_RESTORE_SESSION', ...payload };
}

export function nativeRestoreTitleMessage(payload: {
  sessionId?: string;
  nonce?: string;
  originalTitle?: string;
} = {}): NativeRestoreTitleMessage {
  return { type: 'NATIVE_RESTORE_TITLE', ...payload };
}

export function nativePointerEventMessage(payload: NativePointerPayload): NativePointerEventMessage {
  // `type` after the spread: a host-side NativePointerRequest carries its own
  // `type: 'pointer'`, which must not overwrite the frame message type.
  return { ...payload, type: 'NATIVE_POINTER_EVENT' };
}

export function nativeMediaCommandEventMessage(
  command: NativeMediaCommandName,
  value?: number,
): NativeMediaCommandEventMessage {
  return { type: 'NATIVE_MEDIA_COMMAND_EVENT', command, ...(value !== undefined ? { value } : {}) };
}

export function nativeSessionEventMessage(event: NativeEvent): NativeSessionEventMessage {
  return { type: 'NATIVE_SESSION_EVENT', event };
}
