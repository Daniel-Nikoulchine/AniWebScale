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
import {
  requestNativeConsent,
  resetNativeConsent,
} from './shared/native-consent';
import { createBackgroundRouter } from './background/router';
import { IframeSiteAccessManager, type FrameAccessReply } from './background/iframe-site-access';
import { urlUpdatedMessage, siteAccessResultMessage } from './shared/runtime-messages';
import {
  synchronizeRegisteredContentScripts,
  injectSiteScripts,
} from './site-access';
import { shouldReopenOnboarding } from './shared/onboarding-gating';
import { NativeSession } from './background/native-session';
import { createRealEsrganHttpInfoHandler } from './background/realesrgan-http-info';

const serialized = createAsyncSerializer();
let siteAccessChain: Promise<void> = Promise.resolve();

/**
 * Fire-and-forget serialized work with a rejection handler. Bare `void
 * serialized(...)` drops the operation promise: a mid-cleanup failure
 * (chrome.storage, tab queries, window creation) then surfaces as an
 * MV3 unhandled rejection instead of a one-line warning.
 */
function runBackgroundTask(promise: Promise<unknown>, label: string): void {
  promise.catch(error => {
    console.warn(`[Background] ${label} failed:`, error);
  });
}

const nativeSession = new NativeSession({
  sendToFrame,
  requestOriginConsent,
  isExtensionEnabled,
  serialized,
});

// With manifest host access, new AniWorld/player frames receive the
// declared scripts without waiting for optional permission registration.
// Dynamic registration remains for older installations and explicit grants.
function updateSiteAccess(): Promise<void> {
  if (__ANIME4K_E2E__) return Promise.resolve();
  const operation = siteAccessChain.then(async () => {
    await synchronizeRegisteredContentScripts();
  });
  siteAccessChain = operation.catch(() => undefined);
  return operation;
}

async function isExtensionEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(['extensionEnabled']);
  return stored.extensionEnabled !== false;
}

/** Storage stays authoritative: applySettings persists before it notifies. */
function readNativeConfiguration(): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(['mode', 'quality', 'frameGenerationEnabled']) as Promise<Record<string, unknown>>;
}

async function sendToFrame<T = unknown>(
  tabId: number,
  frameId: number,
  message: unknown,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message, { frameId }) as Promise<T>;
}

async function requestOriginConsent(tabId: number, origin: string): Promise<boolean> {
  return requestNativeConsent(origin, message => sendToFrame(tabId, 0, message));
}

/**
 * Fullscreen-triggered access for cross-origin player frames. Every chrome.*
 * interaction is injected so the state machine stays unit-testable.
 */
const iframeSiteAccess = new IframeSiteAccessManager({
  contains: patterns => chrome.permissions.contains({ origins: patterns }),
  request: patterns => chrome.permissions.request({ origins: patterns }),
  synchronize: () => updateSiteAccess(),
  inject: injectSiteScripts,
  notify: (tabId, origin, outcome, applied) => {
    void chrome.tabs.sendMessage(
      tabId,
      siteAccessResultMessage({ origin, outcome, applied }),
      { frameId: 0 },
    ).catch(() => undefined);
  },
  openGrantPage: (origin, tabId) => {
    // Give the frame a moment to leave fullscreen so the grant popup is
    // actually visible when the direct prompt path is unavailable.
    setTimeout(() => {
      const query = new URLSearchParams({ origin });
      if (tabId !== undefined) query.set('tabId', String(tabId));
      void chrome.windows.create({
        url: chrome.runtime.getURL(`grant.html?${query.toString()}`),
        type: 'popup',
        width: 500,
        height: 480,
      });
    }, 200);
  },
  now: () => Date.now(),
});

function requestFrameSiteAccess(
  origin: string,
  sender: chrome.runtime.MessageSender,
): Promise<FrameAccessReply> {
  return iframeSiteAccess.handle(origin, sender.tab?.id);
}

async function checkOnboarding(): Promise<void> {
  const local = await chrome.storage.local.get(['hasCompletedOnboarding', 'siteAccessModelAcknowledged']);
  if (!shouldReopenOnboarding(local)) return;
  // Do not steal focus from playback when an update installs in the
  // background. The user can still open the guide explicitly from the UI.
  await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html'), active: false });
}

const handleMessage = createBackgroundRouter({
  enhancement: {
    claim: (videoId, sender) => nativeSession.claimEnhancement(videoId, sender),
    release: (videoId, sender) => nativeSession.releaseEnhancement(videoId, sender),
    loadActive: () => nativeSession.store.loadActiveEnhancement(),
    clearActive: () => nativeSession.store.persistActiveEnhancement(null),
  },
  native: {
    startFallback: (request, sender) => nativeSession.startNativeFallback(request, sender),
    activeSession: () => nativeSession.activeSession,
    hasActiveSession: () => nativeSession.hasActiveSession(),
    isControlAuthorized: (message, sender) => nativeSession.isControlAuthorized(message, sender),
    isPlaybackStateAuthorized: (message, sender) => nativeSession.isPlaybackStateAuthorized(message, sender),
    isSenderAuthorized: sender => nativeSession.isSenderAuthorized(sender),
    updateConfiguration: configuration => nativeSession.updateNativeConfiguration(configuration),
    stopSession: (reason, notify, restoreTab, sessionId) =>
      nativeSession.stopNativeSession(reason, notify, restoreTab, sessionId),
    status: () => nativeSession.status as unknown as Record<string, unknown>,
    sendPlaybackState: (sessionId, playbackActive, mediaTime) =>
      nativeSession.sendPlaybackState(sessionId, playbackActive, mediaTime),
    forwardMediaCommand: (command, value) => nativeSession.forwardMediaCommand(command, value),
    forwardPointer: request => nativeSession.forwardPointer(request),
    readConfiguration: readNativeConfiguration,
  },
  platform: {
    serialized,
    isExtensionEnabled,
    updateSiteAccess,
    requestFrameSiteAccess,
    resetConsent: resetNativeConsent,
    openOptionsPage: () => chrome.runtime.openOptionsPage(),
    openOnboarding: () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      return Promise.resolve();
    },
    realEsrganHttpInfo: createRealEsrganHttpInfoHandler(),
  },
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  void handleMessage(request, sender).then(sendResponse, error => {
    console.error('[Background] Message handler failed.', error);
    sendResponse({ ok: false, message: error instanceof Error ? error.message : String(error) });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    runBackgroundTask(serialized(async () => {
      const current = await nativeSession.store.loadActiveEnhancement();
      if (current?.tabId === tabId) await nativeSession.store.persistActiveEnhancement(null);
    }), 'clearing the enhancement claim on navigation');
  }
  if (nativeSession.activeSession?.tabId === tabId && (changeInfo.status === 'loading' || changeInfo.url)) {
    const sessionId = nativeSession.activeSession.sessionId;
    runBackgroundTask(serialized(() => nativeSession.stopNativeSession('The source tab navigated.', true, true, sessionId)), 'stopping the session on navigation');
    return;
  }

  if (changeInfo.status === 'complete' && tab.url) {
    void chrome.tabs.sendMessage(tabId, urlUpdatedMessage(tab.url)).catch(error => {
      if (!String(error?.message ?? error).includes('Receiving end does not exist')) {
        console.warn('[Background] Could not notify a tab about navigation.', error);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  runBackgroundTask(serialized(async () => {
    const current = await nativeSession.store.loadActiveEnhancement();
    if (current?.tabId === tabId) await nativeSession.store.persistActiveEnhancement(null);
  }), 'clearing the enhancement claim on tab close');
  const session = nativeSession.activeSession;
  if (session?.tabId === tabId) {
    const sessionId = session.sessionId;
    runBackgroundTask(serialized(() => nativeSession.stopNativeSession(
      'The source tab was closed.',
      true,
      false,
      sessionId,
    )), 'stopping the session on tab close');
  }
});

chrome.windows.onRemoved.addListener(windowId => {
  const session = nativeSession.activeSession;
  const captureWindowId = session?.captureKind === 'direct-fullscreen'
    ? session.sourceWindowId
    : session?.popupWindowId;
  if (session && captureWindowId === windowId && session.phase !== 'stopping') {
    const sessionId = session.sessionId;
    runBackgroundTask(serialized(() => nativeSession.stopNativeSession('The capture browser window was closed.', true, true, sessionId)), 'stopping the session on window close');
  }
});

chrome.runtime.onStartup.addListener(() => {
  runBackgroundTask(serialized(() => nativeSession.recoverPersistedSession()), 'recovering the persisted session on startup');
  void updateSiteAccess().catch(error => {
    console.warn('[Site access] Startup synchronization failed.', error);
  });
});

chrome.runtime.onInstalled.addListener(details => {
  runBackgroundTask(serialized(async () => {
    await ensureLatestConfig();
    await nativeSession.recoverPersistedSession();
    if (details.reason === 'install' || details.reason === 'update') await checkOnboarding();
  }), 'recovering the persisted session on install');
  void updateSiteAccess().catch(error => {
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
runBackgroundTask(serialized(() => nativeSession.recoverPersistedSession()), 'recovering the persisted session on evaluate');
void updateSiteAccess().catch(error => {
  console.warn('[Site access] Initial synchronization failed.', error);
});
