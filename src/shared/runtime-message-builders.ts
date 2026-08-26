import type { NativeConfiguration } from '../native/protocol';
import type { NativeFallbackRequest } from './native-fallback-request';
import type {
  EnhancementClaimRequest,
  EnhancementReleaseRequest,
  NativePlaybackStateRequest,
  NativeResetConsentRequest,
  NativeStopRequest,
  NativeUpdateConfigurationRequest,
  SettingsUpdatedRequest,
  SiteAccessIframeRequest,
  SiteAccessResultMessage,
  SiteAccessSyncRequest,
  UrlUpdatedMessage,
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

export function urlUpdatedMessage(url?: string): UrlUpdatedMessage {
  return { type: 'URL_UPDATED', ...(url !== undefined ? { url } : {}) };
}

export function nativeConsentRequestMessage(origin?: string): NativeConsentRequestMessage {
  return { type: 'NATIVE_CONSENT_REQUEST', ...(origin !== undefined ? { origin } : {}) };
}
