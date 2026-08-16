import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  injectSiteScripts,
  migrateLegacyBroadSiteAccess,
  removeSiteAccessPatterns,
  sitePatternForUrl,
  synchronizeRegisteredContentScripts,
} from '../src/site-access';

interface ChromeMockOptions {
  origins?: string[];
  registered?: chrome.scripting.RegisteredContentScript[];
  migrated?: boolean;
}

function installChromeMock(options: ChromeMockOptions = {}) {
  const stored: Record<string, unknown> = {
    anime4kGranularSiteAccessV2: options.migrated ?? false,
  };
  const getAll = vi.fn(async () => ({ origins: options.origins ?? [], permissions: [] }));
  const remove = vi.fn(async () => true);
  const storageGet = vi.fn(async () => ({ ...stored }));
  const storageSet = vi.fn(async (update: Record<string, unknown>) => {
    Object.assign(stored, update);
  });
  const getRegisteredContentScripts = vi.fn(async (_filter: chrome.scripting.ContentScriptFilter) =>
    options.registered ?? []);
  const unregisterContentScripts = vi.fn(async (_filter: chrome.scripting.ContentScriptFilter) => undefined);
  const registerContentScripts = vi.fn(async (_scripts: chrome.scripting.RegisteredContentScript[]) => undefined);
  const executeScript = vi.fn(async (
    _injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
  ) => []);

  vi.stubGlobal('chrome', {
    permissions: {
      getAll,
      remove,
    },
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
      },
    },
    scripting: {
      getRegisteredContentScripts,
      unregisterContentScripts,
      registerContentScripts,
      executeScript,
    },
  } as unknown as typeof chrome);

  return {
    executeScript,
    getRegisteredContentScripts,
    registerContentScripts,
    remove,
    storageSet,
    unregisterContentScripts,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('site access', () => {
  it('reduces supported URLs to one exact origin pattern', () => {
    expect(sitePatternForUrl('https://video.example:8443/watch?id=1')).toBe('https://video.example:8443/*');
    expect(sitePatternForUrl('http://localhost:3000/player')).toBe('http://localhost:3000/*');
    expect(sitePatternForUrl('chrome://extensions')).toBeNull();
    expect(sitePatternForUrl(undefined)).toBeNull();
  });

  it('strips legacy blanket grants once while keeping per-site grants', async () => {
    const mock = installChromeMock({
      origins: ['http://*/*', 'https://*/*', 'https://www.crunchyroll.com/*'],
    });
    await migrateLegacyBroadSiteAccess();

    expect(mock.remove).toHaveBeenCalledWith({
      origins: ['http://*/*', 'https://*/*'],
    });
    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.storageSet).toHaveBeenCalledWith({ anime4kGranularSiteAccessV2: true });

    mock.remove.mockClear();
    mock.storageSet.mockClear();
    await migrateLegacyBroadSiteAccess();
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it('migration records its run even when nothing broad was granted', async () => {
    const mock = installChromeMock({ origins: ['https://video.example/*'] });
    await migrateLegacyBroadSiteAccess();

    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.storageSet).toHaveBeenCalledWith({ anime4kGranularSiteAccessV2: true });
  });

  it('registers persistent content scripts for every granted origin', async () => {
    const mock = installChromeMock({ origins: ['https://video.example/*', 'http://localhost:3000/*'] });
    await synchronizeRegisteredContentScripts();

    expect(mock.registerContentScripts).toHaveBeenCalledTimes(1);
    const scripts = mock.registerContentScripts.mock.calls[0][0];
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toMatchObject({
      id: 'aniwebscale-fullscreen-bridge',
      matches: ['http://localhost:3000/*', 'https://video.example/*'],
      js: ['fullscreen-bridge.js'],
      runAt: 'document_start',
      allFrames: true,
      matchOriginAsFallback: true,
      persistAcrossSessions: true,
      world: 'MAIN',
    });
    expect(scripts[1]).toMatchObject({
      id: 'aniwebscale-content',
      matches: ['http://localhost:3000/*', 'https://video.example/*'],
      js: ['content.js'],
      runAt: 'document_idle',
      world: 'ISOLATED',
    });
  });

  it('leaves matching registrations untouched', async () => {
    const mock = installChromeMock({
      origins: ['https://video.example/*'],
      registered: [
        {
          id: 'aniwebscale-fullscreen-bridge',
          matches: ['https://video.example/*'],
          js: ['fullscreen-bridge.js'],
          runAt: 'document_start',
          allFrames: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true,
          world: 'MAIN',
        },
        {
          id: 'aniwebscale-content',
          matches: ['https://video.example/*'],
          js: ['content.js'],
          runAt: 'document_idle',
          allFrames: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true,
          world: 'ISOLATED',
        },
      ],
    });
    await synchronizeRegisteredContentScripts();

    expect(mock.unregisterContentScripts).not.toHaveBeenCalled();
    expect(mock.registerContentScripts).not.toHaveBeenCalled();
  });

  it('re-registers when the granted origins changed', async () => {
    const mock = installChromeMock({
      origins: ['https://video.example/*'],
      registered: [
        {
          id: 'aniwebscale-content',
          matches: ['https://other.example/*'],
          js: ['content.js'],
          runAt: 'document_idle',
          allFrames: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true,
          world: 'ISOLATED',
        },
      ],
    });
    await synchronizeRegisteredContentScripts();

    expect(mock.unregisterContentScripts).toHaveBeenCalledWith({ ids: ['aniwebscale-content'] });
    expect(mock.registerContentScripts).toHaveBeenCalledTimes(1);
  });

  it('unregisters everything when no origin is granted', async () => {
    const mock = installChromeMock({
      registered: [
        {
          id: 'aniwebscale-content',
          matches: ['https://video.example/*'],
          js: ['content.js'],
          runAt: 'document_idle',
          allFrames: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true,
          world: 'ISOLATED',
        },
      ],
    });
    await synchronizeRegisteredContentScripts();

    expect(mock.unregisterContentScripts).toHaveBeenCalledWith({ ids: ['aniwebscale-content'] });
    expect(mock.registerContentScripts).not.toHaveBeenCalled();
  });

  it('injects the main-world bridge before the isolated content script', async () => {
    const mock = installChromeMock();
    await injectSiteScripts(42);

    expect(mock.executeScript.mock.calls).toEqual([
      [{ target: { tabId: 42, allFrames: true }, files: ['fullscreen-bridge.js'], world: 'MAIN' }],
      [{ target: { tabId: 42, allFrames: true }, files: ['content.js'], world: 'ISOLATED' }],
    ]);
  });

  it('removes only well-formed http origin patterns', async () => {
    const mock = installChromeMock();
    await removeSiteAccessPatterns(['https://video.example/*', 'chrome://extensions', 'https://video.example/*']);

    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith({ origins: ['https://video.example/*'] });
  });
});
