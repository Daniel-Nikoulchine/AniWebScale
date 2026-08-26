import {
  isNativeConfiguration,
  type NativeConfiguration,
  type NativeMediaCommandName,
} from '../native/protocol';
import { parseRuntimeRequest, type NativePointerRequest } from '../shared/runtime-messages';
import type { NativeFallbackRequest } from '../shared/native-fallback-request';
import type { FrameAccessReply } from './iframe-site-access';
import type {
  NativeSessionControlMessage,
  NativeSessionIdentity,
} from '../shared/native-session-messages';

/** The enhancement claim and durable record operations used by the router. */
export interface BackgroundEnhancementOperations {
  claim(videoId: string, sender: chrome.runtime.MessageSender): Promise<unknown>;
  release(videoId: string, sender: chrome.runtime.MessageSender): Promise<void>;
  loadActive(): Promise<{ tabId?: number } | null>;
  clearActive(): Promise<void>;
}

/** The native-session operations used by the router. */
export interface BackgroundNativeOperations {
  startFallback(request: NativeFallbackRequest, sender: chrome.runtime.MessageSender): Promise<unknown>;
  activeSession(): NativeSessionIdentity | null;
  hasActiveSession(): boolean;
  isControlAuthorized(message: NativeSessionControlMessage, sender: chrome.runtime.MessageSender): boolean;
  isPlaybackStateAuthorized(message: NativeSessionControlMessage, sender: chrome.runtime.MessageSender): boolean;
  isSenderAuthorized(sender: chrome.runtime.MessageSender): boolean;
  updateConfiguration(configuration: NativeConfiguration): Promise<void>;
  stopSession(reason: string, notify: boolean, restoreTab?: boolean, sessionId?: string): Promise<void>;
  status(): Record<string, unknown>;
  sendPlaybackState(sessionId: string, playbackActive: boolean, mediaTime: number): Promise<void>;
  forwardMediaCommand(command: NativeMediaCommandName, value?: number): Promise<void>;
  forwardPointer(request: NativePointerRequest): Promise<void>;
  readConfiguration(): Promise<Record<string, unknown>>;
}

/** Browser and user-facing operations kept outside request policy. */
export interface BackgroundPlatformOperations {
  serialized<T>(task: () => Promise<T>): Promise<T>;
  isExtensionEnabled(): Promise<boolean>;
  updateSiteAccess(): Promise<void>;
  requestFrameSiteAccess(origin: string, sender: chrome.runtime.MessageSender): Promise<FrameAccessReply>;
  resetConsent(origin?: string): Promise<void>;
  openOptionsPage(): Promise<void>;
  openOnboarding(): Promise<void>;
}

/**
 * The router now depends on three cohesive adapters rather than mirroring
 * every implementation method. Request policy stays here; enhancement,
 * Native-Session, and platform details remain behind their own seams.
 */
export interface BackgroundRouterDependencies {
  enhancement: BackgroundEnhancementOperations;
  native: BackgroundNativeOperations;
  platform: BackgroundPlatformOperations;
}

export type BackgroundMessageHandler = (
  request: unknown,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown>;

export function createBackgroundRouter(deps: BackgroundRouterDependencies): BackgroundMessageHandler {
  return async function handleMessage(request: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
    const parsed = parseRuntimeRequest(request);
    if (parsed.kind === 'unknown') return undefined;
    if (parsed.kind === 'invalid') {
      return { ok: false, ...(parsed.status ? { status: parsed.status } : {}), message: parsed.message };
    }
    const message = parsed.message;

    switch (message.type) {
      case 'ENHANCEMENT_CLAIM':
        return deps.enhancement.claim(message.videoId, sender);

      case 'ENHANCEMENT_RELEASE':
        if (typeof message.videoId === 'string') {
          await deps.enhancement.release(message.videoId, sender);
        }
        return { ok: true };

      case 'NATIVE_FALLBACK_REQUEST':
        if (!await deps.platform.isExtensionEnabled()) {
          return { ok: false, status: 'denied', message: 'AniWebScale is disabled.' };
        }
        return deps.native.startFallback(message, sender);

      case 'NATIVE_UPDATE_CONFIGURATION': {
        try {
          await deps.platform.serialized(async () => {
            if (!deps.native.hasActiveSession() || !deps.native.isControlAuthorized(message, sender)) {
              throw new Error('The native configuration update did not come from the active video.');
            }
            await deps.native.updateConfiguration(message.configuration);
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      }

      case 'NATIVE_STOP':
        return deps.platform.serialized(async () => {
          if (!deps.native.hasActiveSession()) return { ok: true };
          if (!deps.native.isControlAuthorized(message, sender)) {
            return { ok: false, message: 'The native stop request did not belong to the active session.' };
          }
          await deps.native.stopSession('Stopped by the user.', true);
          return { ok: true };
        });

      case 'NATIVE_STATUS':
        return { ok: true, ...deps.native.status() };

      case 'NATIVE_PLAYBACK_STATE': {
        const session = deps.native.activeSession();
        if (!session || !deps.native.isPlaybackStateAuthorized(message, sender)) {
          return { ok: false, message: 'Invalid native playback state.' };
        }
        await deps.native.sendPlaybackState(session.sessionId, message.playbackActive, message.mediaTime);
        return { ok: true };
      }

      case 'NATIVE_MEDIA_COMMAND': {
        if (!deps.native.hasActiveSession() || !deps.native.isSenderAuthorized(sender)) {
          return { ok: false, message: 'The native media command did not come from the active session.' };
        }
        await deps.native.forwardMediaCommand(message.command, message.value);
        return { ok: true };
      }

      case 'NATIVE_POINTER': {
        if (!deps.native.hasActiveSession() || !deps.native.isSenderAuthorized(sender)) {
          return { ok: false, message: 'The native pointer event did not come from the active session.' };
        }
        await deps.native.forwardPointer(message);
        return { ok: true };
      }

      case 'NATIVE_RESET_CONSENT':
        await deps.platform.resetConsent(message.origin);
        return { ok: true };

      case 'SETTINGS_UPDATED': {
        // Content scripts watch storage.onChanged and re-apply their own
        // renderers; this handler only (a) stops the active native session
        // when the extension was disabled and (b) pushes the configuration
        // to an orphaned native host that would otherwise keep the old one.
        const extensionEnabled = await deps.platform.isExtensionEnabled();
        const current = await deps.enhancement.loadActive();
        if (!extensionEnabled) {
          await deps.platform.serialized(() => deps.native.stopSession('AniWebScale was disabled.', true));
          await deps.enhancement.clearActive();
          return { ok: true };
        }
        if (current && deps.native.hasActiveSession()) {
          const configuration = await deps.native.readConfiguration();
          if (isNativeConfiguration(configuration)) {
            await deps.platform.serialized(() => deps.native.updateConfiguration(configuration));
          }
        }
        return { ok: true };
      }

      case 'SITE_ACCESS_SYNC':
        await deps.platform.updateSiteAccess();
        return { ok: true };

      case 'SITE_ACCESS_IFRAME_REQUEST':
        return deps.platform.requestFrameSiteAccess(message.origin, sender);

      case 'OPEN_OPTIONS_PAGE':
        await deps.platform.openOptionsPage();
        return undefined;

      case 'OPEN_ONBOARDING':
        await deps.platform.openOnboarding();
        return undefined;
    }
  };
}
