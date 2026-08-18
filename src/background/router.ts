import {
  isNativeConfiguration,
  type NativeConfiguration,
  type NativeMediaCommandName,
} from '../native/protocol';
import { parseRuntimeRequest, type NativePointerRequest } from '../shared/runtime-messages';
import type { NativeFallbackRequest } from '../shared/native-fallback-request';
import type { FrameAccessReply } from './iframe-site-access';
import {
  isNativePlaybackStateAuthorized,
  isNativeSessionControlAuthorized,
  type NativeSessionIdentity,
} from '../shared/native-session-messages';

/**
 * Everything the message router needs, as one explicit injectable interface.
 * background.ts implements each member against NativeSession and chrome.*;
 * tests implement them with fakes. This is the same treatment NativeSession
 * already gives the native pipeline, lifted one level: the router's logic —
 * consent resets, settings orchestration, authorization, onboarding and
 * options routing — becomes importable and testable without chrome globals.
 */
export interface BackgroundRouterDependencies {
  claim(videoId: string, sender: chrome.runtime.MessageSender): Promise<unknown>;
  releaseEnhancement(videoId: string, sender: chrome.runtime.MessageSender): Promise<void>;
  startNativeFallback(request: NativeFallbackRequest, sender: chrome.runtime.MessageSender): Promise<unknown>;
  activeSession(): NativeSessionIdentity | null;
  updateConfiguration(configuration: NativeConfiguration): Promise<void>;
  stopSession(reason: string, notify: boolean, restoreTab?: boolean, sessionId?: string): Promise<void>;
  status(): Record<string, unknown>;
  sendPlaybackState(sessionId: string, playbackActive: boolean, mediaTime: number): Promise<void>;
  forwardMediaCommand(command: NativeMediaCommandName, value?: number): Promise<void>;
  forwardPointer(request: NativePointerRequest): Promise<void>;
  loadActiveEnhancement(): Promise<{ tabId?: number } | null>;
  persistActiveEnhancement(value: null): Promise<void>;
  serialized<T>(task: () => Promise<T>): Promise<T>;
  isExtensionEnabled(): Promise<boolean>;
  readNativeConfiguration(): Promise<Record<string, unknown>>;
  updateSiteAccess(): Promise<void>;
  requestFrameSiteAccess(origin: string, sender: chrome.runtime.MessageSender): Promise<FrameAccessReply>;
  resetConsent(origin?: string): Promise<void>;
  openOptionsPage(): Promise<void>;
  openOnboarding(): Promise<void>;
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
        return deps.claim(message.videoId, sender);

      case 'ENHANCEMENT_RELEASE':
        if (typeof message.videoId === 'string') {
          await deps.releaseEnhancement(message.videoId, sender);
        }
        return { ok: true };

      case 'NATIVE_FALLBACK_REQUEST':
        if (!await deps.isExtensionEnabled()) {
          return { ok: false, status: 'denied', message: 'AniWebScale is disabled.' };
        }
        return deps.startNativeFallback(message, sender);

      case 'NATIVE_UPDATE_CONFIGURATION': {
        try {
          await deps.serialized(async () => {
            const session = deps.activeSession();
            if (!session || !isNativeSessionControlAuthorized(session, message, {
              tabId: sender.tab?.id,
              frameId: sender.frameId,
            })) {
              throw new Error('The native configuration update did not come from the active video.');
            }
            await deps.updateConfiguration(message.configuration);
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      }

      case 'NATIVE_STOP':
        return deps.serialized(async () => {
          const session = deps.activeSession();
          if (!session) return { ok: true };
          if (!isNativeSessionControlAuthorized(session, message, {
            tabId: sender.tab?.id,
            frameId: sender.frameId,
          })) {
            return { ok: false, message: 'The native stop request did not belong to the active session.' };
          }
          await deps.stopSession('Stopped by the user.', true);
          return { ok: true };
        });

      case 'NATIVE_STATUS':
        return { ok: true, ...deps.status() };

      case 'NATIVE_PLAYBACK_STATE': {
        const session = deps.activeSession();
        if (!session || !isNativePlaybackStateAuthorized(session, message, {
          tabId: sender.tab?.id,
          frameId: sender.frameId,
        })) {
          return { ok: false, message: 'Invalid native playback state.' };
        }
        await deps.sendPlaybackState(session.sessionId, message.playbackActive, message.mediaTime);
        return { ok: true };
      }

      case 'NATIVE_MEDIA_COMMAND':
        await deps.forwardMediaCommand(message.command, message.value);
        return { ok: true };

      case 'NATIVE_POINTER':
        await deps.forwardPointer(message);
        return { ok: true };

      case 'NATIVE_RESET_CONSENT':
        await deps.resetConsent(message.origin);
        return { ok: true };

      case 'SETTINGS_UPDATED': {
        // Content scripts watch storage.onChanged and re-apply their own
        // renderers; this handler only (a) stops the active native session
        // when the extension was disabled and (b) pushes the configuration
        // to an orphaned native host that would otherwise keep the old one.
        const extensionEnabled = await deps.isExtensionEnabled();
        const current = await deps.loadActiveEnhancement();
        if (!extensionEnabled) {
          await deps.serialized(() => deps.stopSession('AniWebScale was disabled.', true));
          await deps.persistActiveEnhancement(null);
          return { ok: true };
        }
        if (current && deps.activeSession()) {
          const configuration = await deps.readNativeConfiguration();
          if (isNativeConfiguration(configuration)) {
            await deps.serialized(() => deps.updateConfiguration(configuration));
          }
        }
        return { ok: true };
      }

      case 'SITE_ACCESS_SYNC':
        await deps.updateSiteAccess();
        return { ok: true };

      case 'SITE_ACCESS_IFRAME_REQUEST':
        return deps.requestFrameSiteAccess(message.origin, sender);

      case 'OPEN_OPTIONS_PAGE':
        await deps.openOptionsPage();
        return undefined;

      case 'OPEN_ONBOARDING':
        await deps.openOnboarding();
        return undefined;
    }
  };
}
