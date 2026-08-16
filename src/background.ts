/**
 * Background service worker entry point.
 *
 * Thin message router: every native-session state transition, event routing
 * and status mirroring lives in the NativeSession machine
 * (./background/native-session). This file owns the chrome.* listeners,
 * consent bookkeeping, site-access synchronization and onboarding.
 */
import { ensureLatestConfig } from './utils/migration';
import { createAsyncSerializer } from './shared/async-serializer';
import { isNativeConfiguration } from './native/protocol';
import {
  parseRuntimeRequest,
  type NativePointerRequest,
} from './shared/runtime-messages';
import { parseNativeConsentResponse } from './shared/native-session-messages';
import { isNativePlaybackStateAuthorized, isNativeSessionControlAuthorized } from './shared/native-session-messages';
import {
  migrateLegacyBroadSiteAccess,
  synchronizeRegisteredContentScripts,
} from './site-access';
import { NativeSession } from './background/native-session';

const CONSENT_STORAGE_KEY = 'anime4kNativeConsentByOrigin';

const serialized = createAsyncSerializer();
let siteAccessChain: Promise<void> = Promise.resolve();

const nativeSession = new NativeSession({
  sendToFrame,
  requestOriginConsent,
  isExtensionEnabled,
  serialized,
});

/** The last known native renderer status, mirrored to interested frames. */
function currentStatus() {
  return nativeSession.status;
}

function updateSiteAccess(migrateLegacy = false): Promise<void> {
  if (__ANIME4K_E2E__) return Promise.resolve();
  const operation = siteAccessChain.then(async () => {
    if (migrateLegacy) await migrateLegacyBroadSiteAccess();
    await synchronizeRegisteredContentScripts();
  });
  siteAccessChain = operation.catch(() => undefined);
  return operation;
}

async function isExtensionEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(['extensionEnabled']);
  return stored.extensionEnabled !== false;
}

async function sendToFrame<T = unknown>(
  tabId: number,
  frameId: number,
  message: unknown,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message, { frameId }) as Promise<T>;
}

async function requestOriginConsent(tabId: number, origin: string): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONSENT_STORAGE_KEY);
  const consentByOrigin = (stored[CONSENT_STORAGE_KEY] ?? {}) as Record<string, boolean>;
  if (typeof consentByOrigin[origin] === 'boolean') {
    return consentByOrigin[origin];
  }

  let response: { allowed?: unknown } | undefined;
  try {
    response = await sendToFrame<{ allowed?: unknown }>(tabId, 0, {
      type: 'NATIVE_CONSENT_REQUEST',
      origin,
    });
  } catch (error) {
    console.warn('[NativeBridge] Could not show native fallback consent.', error);
    return false;
  }

  const allowed = parseNativeConsentResponse(response);
  if (allowed === null) return false;
  consentByOrigin[origin] = allowed;
  await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consentByOrigin });
  return allowed;
}

async function checkOnboarding(): Promise<void> {
  const local = await chrome.storage.local.get('hasCompletedOnboarding');
  if (!local.hasCompletedOnboarding) {
    // Do not steal focus from playback when an update installs in the
    // background. The user can still open the guide explicitly from the UI.
    await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html'), active: false });
  }
}

async function handleMessage(request: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const parsed = parseRuntimeRequest(request);
  if (parsed.kind === 'unknown') return undefined;
  if (parsed.kind === 'invalid') {
    return { ok: false, ...(parsed.status ? { status: parsed.status } : {}), message: parsed.message };
  }
  const message = parsed.message;

  switch (message.type) {
    case 'ENHANCEMENT_CLAIM':
      return nativeSession.claimEnhancement(message.videoId, sender);

    case 'ENHANCEMENT_RELEASE':
      if (typeof message.videoId === 'string') {
        await nativeSession.releaseEnhancement(message.videoId, sender);
      }
      return { ok: true };

    case 'NATIVE_FALLBACK_REQUEST':
      if (!await isExtensionEnabled()) {
        return { ok: false, status: 'denied', message: 'AniWebScale is disabled.' };
      }
      return nativeSession.startNativeFallback(message, sender);

    case 'NATIVE_UPDATE_CONFIGURATION': {
      try {
        await serialized(async () => {
          const session = nativeSession.activeSession;
          if (!session || !isNativeSessionControlAuthorized(session, message, {
            tabId: sender.tab?.id,
            frameId: sender.frameId,
          })) {
            throw new Error('The native configuration update did not come from the active video.');
          }
          await nativeSession.updateNativeConfiguration(message.configuration);
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    }

    case 'NATIVE_STOP':
      return serialized(async () => {
        const session = nativeSession.activeSession;
        if (!session) return { ok: true };
        if (!isNativeSessionControlAuthorized(session, message, {
          tabId: sender.tab?.id,
          frameId: sender.frameId,
        })) {
          return { ok: false, message: 'The native stop request did not belong to the active session.' };
        }
        await nativeSession.stopNativeSession('Stopped by the user.', true);
        return { ok: true };
      });

    case 'NATIVE_STATUS':
      return { ok: true, ...currentStatus() };

    case 'NATIVE_PLAYBACK_STATE': {
      const session = nativeSession.activeSession;
      if (!session || !isNativePlaybackStateAuthorized(session, message, {
        tabId: sender.tab?.id,
        frameId: sender.frameId,
      })) {
        return { ok: false, message: 'Invalid native playback state.' };
      }
      await nativeSession.sendPlaybackState(session.sessionId, message.playbackActive, message.mediaTime);
      return { ok: true };
    }

    case 'NATIVE_MEDIA_COMMAND':
      await nativeSession.forwardMediaCommand(message.command, message.value);
      return { ok: true };

    case 'NATIVE_POINTER':
      await nativeSession.forwardPointer(message as NativePointerRequest);
      return { ok: true };

    case 'NATIVE_RESET_CONSENT': {
      if (typeof message.origin === 'string') {
        const stored = await chrome.storage.local.get(CONSENT_STORAGE_KEY);
        const consents = (stored[CONSENT_STORAGE_KEY] ?? {}) as Record<string, boolean>;
        delete consents[message.origin];
        await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consents });
      } else {
        await chrome.storage.local.remove(CONSENT_STORAGE_KEY);
      }
      return { ok: true };
    }

    case 'SETTINGS_UPDATED': {
      // Content scripts watch storage.onChanged and re-apply their own
      // renderers; the message is only used to (a) patch the native host when
      // the active session needs the configuration pushed explicitly, and
      // (b) report whether the update could be applied to the popup.
      const extensionEnabled = await isExtensionEnabled();
      const current = await nativeSession.store.loadActiveEnhancement();
      if (!extensionEnabled) {
        await serialized(() => nativeSession.stopNativeSession('AniWebScale was disabled.', true));
        await nativeSession.store.persistActiveEnhancement(null);
        return { ok: true };
      }
      if (current && nativeSession.activeSession) {
        // Only update the native host here when recovering an orphaned
        // session; otherwise the same expensive native pipeline would be
        // rebuilt twice.
        const settings = await chrome.storage.local.get(['mode', 'quality', 'frameGenerationEnabled']);
        const configuration = {
          mode: settings.mode,
          quality: settings.quality,
          frameGenerationEnabled: settings.frameGenerationEnabled,
        };
        if (isNativeConfiguration(configuration)) {
          await serialized(() => nativeSession.updateNativeConfiguration(configuration));
        }
      }
      return { ok: true };
    }

    case 'SITE_ACCESS_SYNC':
      await updateSiteAccess();
      return { ok: true };

    case 'OPEN_OPTIONS_PAGE':
      await chrome.runtime.openOptionsPage();
      return undefined;

    case 'OPEN_ONBOARDING':
      await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  void handleMessage(request, sender).then(sendResponse, error => {
    console.error('[Background] Message handler failed.', error);
    sendResponse({ ok: false, message: error instanceof Error ? error.message : String(error) });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    void serialized(async () => {
      const current = await nativeSession.store.loadActiveEnhancement();
      if (current?.tabId === tabId) await nativeSession.store.persistActiveEnhancement(null);
    });
  }
  if (nativeSession.activeSession?.tabId === tabId && (changeInfo.status === 'loading' || changeInfo.url)) {
    const sessionId = nativeSession.activeSession.sessionId;
    void serialized(() => nativeSession.stopNativeSession('The source tab navigated.', true, true, sessionId));
    return;
  }

  if (changeInfo.status === 'complete' && tab.url) {
    void chrome.tabs.sendMessage(tabId, { type: 'URL_UPDATED', url: tab.url }).catch(error => {
      if (!String(error?.message ?? error).includes('Receiving end does not exist')) {
        console.warn('[Background] Could not notify a tab about navigation.', error);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  void serialized(async () => {
    const current = await nativeSession.store.loadActiveEnhancement();
    if (current?.tabId === tabId) await nativeSession.store.persistActiveEnhancement(null);
  });
  const session = nativeSession.activeSession;
  if (session?.tabId === tabId) {
    const sessionId = session.sessionId;
    void serialized(() => nativeSession.stopNativeSession(
      'The source tab was closed.',
      true,
      false,
      sessionId,
    ));
  }
});

chrome.windows.onRemoved.addListener(windowId => {
  const session = nativeSession.activeSession;
  const captureWindowId = session?.captureKind === 'direct-fullscreen'
    ? session.sourceWindowId
    : session?.popupWindowId;
  if (session && captureWindowId === windowId && session.phase !== 'stopping') {
    const sessionId = session.sessionId;
    void serialized(() => nativeSession.stopNativeSession('The capture browser window was closed.', true, true, sessionId));
  }
});

chrome.runtime.onStartup.addListener(() => {
  void serialized(() => nativeSession.recoverPersistedSession());
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Startup synchronization failed.', error);
  });
});

chrome.runtime.onInstalled.addListener(details => {
  void serialized(async () => {
    await ensureLatestConfig();
    await nativeSession.recoverPersistedSession();
    if (details.reason === 'install' || details.reason === 'update') await checkOnboarding();
  });
  void updateSiteAccess(true).catch(error => {
    console.warn('[Site access] Installation synchronization failed.', error);
  });
});

chrome.permissions.onAdded.addListener(() => {
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Could not register scripts for newly granted access.', error);
  });
});

chrome.permissions.onRemoved.addListener(() => {
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Could not remove scripts for revoked access.', error);
  });
});

// MV3 service workers can restart without onStartup. Reconcile the durable
// session every time the background module itself is evaluated.
void serialized(() => nativeSession.recoverPersistedSession());
void updateSiteAccess(true).catch(error => {
  console.warn('[Site access] Initial synchronization failed.', error);
});
