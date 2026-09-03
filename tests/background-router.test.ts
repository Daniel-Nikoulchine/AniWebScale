import { describe, expect, it, vi } from 'vitest';
import { createBackgroundRouter, type BackgroundRouterDependencies } from '../src/background/router';
import type { NativeSessionIdentity } from '../src/shared/native-session-messages';
import type { RealEsrganHttpEndpoint } from '../src/background/realesrgan-http-info';

const SESSION: NativeSessionIdentity = {
  sessionId: 'session-1',
  tabId: 7,
  frameId: 0,
  videoId: 'video-1',
};

function installDeps(overrides: {
  enhancement?: Partial<BackgroundRouterDependencies['enhancement']>;
  native?: Partial<BackgroundRouterDependencies['native']>;
  platform?: Partial<BackgroundRouterDependencies['platform']>;
} = {}) {
  const deps: BackgroundRouterDependencies = {
    enhancement: {
      claim: vi.fn(async () => ({ ok: true })),
      release: vi.fn(async () => undefined),
      loadActive: vi.fn(async () => ({ tabId: 7 })),
      clearActive: vi.fn(async () => undefined),
      ...overrides.enhancement,
    },
    native: {
      startFallback: vi.fn(async () => ({ ok: true, sessionId: 'session-1' })),
      activeSession: vi.fn(() => SESSION),
      hasActiveSession: vi.fn(() => true),
      isControlAuthorized: vi.fn((_message, sender) => sender.tab?.id === SESSION.tabId
        && (sender.frameId ?? 0) === SESSION.frameId),
      isPlaybackStateAuthorized: vi.fn((_message, sender) => sender.tab?.id === SESSION.tabId
        && (sender.frameId ?? 0) === SESSION.frameId),
      isSenderAuthorized: vi.fn(sender => sender.tab?.id === SESSION.tabId
        && (sender.frameId ?? 0) === SESSION.frameId),
      updateConfiguration: vi.fn(async () => undefined),
      stopSession: vi.fn(async () => undefined),
      status: vi.fn(() => ({ active: true, state: 'streaming' })),
      sendPlaybackState: vi.fn(async () => undefined),
      forwardMediaCommand: vi.fn(async () => undefined),
      forwardPointer: vi.fn(async () => undefined),
      readConfiguration: vi.fn(async () => ({ mode: 'A', quality: 'M', frameGenerationEnabled: false })),
      ...overrides.native,
    },
    platform: {
      serialized: vi.fn(task => task()),
      isExtensionEnabled: vi.fn(async () => true),
      updateSiteAccess: vi.fn(async () => undefined),
      requestFrameSiteAccess: vi.fn(async () => ({ ok: true, outcome: 'injected' as const })),
      resetConsent: vi.fn(async () => undefined),
      openOptionsPage: vi.fn(async () => undefined),
      openOnboarding: vi.fn(async () => undefined),
      realEsrganHttpInfo: vi.fn(async (): Promise<RealEsrganHttpEndpoint> => ({ ok: false, message: 'not wired in tests' })),
      ...overrides.platform,
    },
  };
  return { deps, handleMessage: createBackgroundRouter(deps) };
}

const senderFrom = (session = SESSION): chrome.runtime.MessageSender => ({
  tab: { id: session.tabId },
  frameId: session.frameId,
} as unknown as chrome.runtime.MessageSender);

describe('background router', () => {
  it('returns undefined for unknown message types', async () => {
    const { handleMessage } = installDeps();
    await expect(handleMessage({ type: 'SOMETHING_ELSE' }, {} as chrome.runtime.MessageSender))
      .resolves.toBeUndefined();
  });

  it('answers malformed payloads with the exact rejection envelope', async () => {
    const { handleMessage } = installDeps();
    await expect(handleMessage({ type: 'ENHANCEMENT_CLAIM' }, {} as chrome.runtime.MessageSender))
      .resolves.toEqual({ ok: false, message: 'Missing video ID.' });
    await expect(handleMessage({ type: 'NATIVE_FALLBACK_REQUEST' }, {} as chrome.runtime.MessageSender))
      .resolves.toEqual({ ok: false, status: 'denied', message: 'The native fallback request was invalid.' });
  });

  it('denies native fallback while the extension is disabled', async () => {
    const { deps, handleMessage } = installDeps({ platform: { isExtensionEnabled: vi.fn(async () => false) } });
    await expect(handleMessage({
      type: 'NATIVE_FALLBACK_REQUEST',
      videoId: 'video-1',
      reason: 'eme',
      configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      output: 'auto',
      videoRect: { x: 0, y: 0, width: 320, height: 180, devicePixelRatio: 1 },
    }, senderFrom())).resolves.toEqual({
      ok: false,
      status: 'denied',
      message: 'AniWebScale is disabled.',
    });
    expect(deps.native.startFallback).not.toHaveBeenCalled();
  });

  it('rejects control messages from senders outside the active session', async () => {
    const { handleMessage } = installDeps();
    const outsider = { tab: { id: 99 }, frameId: 3 } as unknown as chrome.runtime.MessageSender;

    await expect(handleMessage({
      type: 'NATIVE_STOP',
      sessionId: SESSION.sessionId,
      videoId: SESSION.videoId,
    }, outsider)).resolves.toEqual({
      ok: false,
      message: 'The native stop request did not belong to the active session.',
    });
  });

  it('rejects native input commands from a different tab or frame', async () => {
    const { deps, handleMessage } = installDeps();
    const outsider = { tab: { id: 99 }, frameId: 4 } as unknown as chrome.runtime.MessageSender;

    await expect(handleMessage({ type: 'NATIVE_MEDIA_COMMAND', command: 'pause' }, outsider))
      .resolves.toEqual({
        ok: false,
        message: 'The native media command did not come from the active session.',
      });
    await expect(handleMessage({
      type: 'NATIVE_POINTER', event: 'move', x: 0.5, y: 0.5,
    }, outsider)).resolves.toEqual({
      ok: false,
      message: 'The native pointer event did not come from the active session.',
    });
    expect(deps.native.forwardMediaCommand).not.toHaveBeenCalled();
    expect(deps.native.forwardPointer).not.toHaveBeenCalled();
  });

  it('forwards native input commands only from the owning frame', async () => {
    const { deps, handleMessage } = installDeps();
    const owner = senderFrom();

    await expect(handleMessage({ type: 'NATIVE_MEDIA_COMMAND', command: 'pause' }, owner))
      .resolves.toEqual({ ok: true });
    await expect(handleMessage({
      type: 'NATIVE_POINTER', event: 'move', x: 0.5, y: 0.5,
    }, owner)).resolves.toEqual({ ok: true });
    expect(deps.native.forwardMediaCommand).toHaveBeenCalledWith('pause', undefined);
    expect(deps.native.forwardPointer).toHaveBeenCalledWith(expect.objectContaining({ event: 'move' }));
  });

  it('stops the session and clears the claim when settings arrive while disabled', async () => {
    const { deps, handleMessage } = installDeps({ platform: { isExtensionEnabled: vi.fn(async () => false) } });

    await expect(handleMessage({ type: 'SETTINGS_UPDATED' }, senderFrom())).resolves.toEqual({ ok: true });
    expect(deps.native.stopSession).toHaveBeenCalledWith('AniWebScale was disabled.', true);
    expect(deps.enhancement.clearActive).toHaveBeenCalled();
    expect(deps.native.updateConfiguration).not.toHaveBeenCalled();
  });

  it('pushes the persisted configuration only for an orphaned live session', async () => {
    const { deps, handleMessage } = installDeps();

    await expect(handleMessage({ type: 'SETTINGS_UPDATED' }, senderFrom())).resolves.toEqual({ ok: true });
    expect(deps.native.readConfiguration).toHaveBeenCalled();
    expect(deps.native.updateConfiguration).toHaveBeenCalledWith({
      mode: 'A', quality: 'M', frameGenerationEnabled: false,
    });

    const idle = installDeps({
      native: {
        activeSession: vi.fn(() => null),
        hasActiveSession: vi.fn(() => false),
      },
    });
    await idle.handleMessage({ type: 'SETTINGS_UPDATED' }, senderFrom());
    expect(idle.deps.native.updateConfiguration).not.toHaveBeenCalled();
  });

  it('resets one consent origin or all of them', async () => {
    const { deps, handleMessage } = installDeps();
    await handleMessage({ type: 'NATIVE_RESET_CONSENT', origin: 'https://a.example' }, senderFrom());
    expect(deps.platform.resetConsent).toHaveBeenCalledWith('https://a.example');
    await handleMessage({ type: 'NATIVE_RESET_CONSENT' }, senderFrom());
    expect(deps.platform.resetConsent).toHaveBeenCalledWith(undefined);
  });

  it('rejects an invalid consent origin without clearing all consents', async () => {
    const { deps, handleMessage } = installDeps();
    await expect(handleMessage({
      type: 'NATIVE_RESET_CONSENT',
      origin: 'javascript:alert(1)',
    }, senderFrom())).resolves.toEqual({ ok: false, message: 'Invalid consent origin.' });
    expect(deps.platform.resetConsent).not.toHaveBeenCalled();
  });

  it('routes site-access sync, options and onboarding to their deps', async () => {
    const { deps, handleMessage } = installDeps();
    await handleMessage({ type: 'SITE_ACCESS_SYNC' }, senderFrom());
    expect(deps.platform.updateSiteAccess).toHaveBeenCalledTimes(1);
    await handleMessage({ type: 'OPEN_OPTIONS_PAGE' }, senderFrom());
    expect(deps.platform.openOptionsPage).toHaveBeenCalledTimes(1);
    await handleMessage({ type: 'OPEN_ONBOARDING' }, senderFrom());
    expect(deps.platform.openOnboarding).toHaveBeenCalledTimes(1);
  });

  it('routes fullscreen player access requests to the manager', async () => {
    const { deps, handleMessage } = installDeps();
    const sender = senderFrom();
    await expect(handleMessage({
      type: 'SITE_ACCESS_IFRAME_REQUEST',
      origin: 'https://voe.sx',
    }, sender)).resolves.toEqual({ ok: true, outcome: 'injected' });
    expect(deps.platform.requestFrameSiteAccess).toHaveBeenCalledWith('https://voe.sx', sender);
  });

  it('rejects player access requests with a non-http origin', async () => {
    const { deps, handleMessage } = installDeps();
    await expect(handleMessage({
      type: 'SITE_ACCESS_IFRAME_REQUEST',
      origin: 'chrome://settings',
    }, senderFrom())).resolves.toEqual({ ok: false, message: 'Invalid player origin.' });
    expect(deps.platform.requestFrameSiteAccess).not.toHaveBeenCalled();
  });

  it('spreads the mirrored status into the status response', async () => {
    const { handleMessage } = installDeps();
    await expect(handleMessage({ type: 'NATIVE_STATUS' }, senderFrom()))
      .resolves.toEqual({ ok: true, active: true, state: 'streaming' });
  });
});
