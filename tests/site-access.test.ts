import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasAllWebsiteAccess,
  injectSiteScripts,
  migrateLegacyBroadSiteAccess,
  requestAllWebsiteAccess,
  sitePatternForUrl,
  synchronizeRegisteredContentScripts,
} from '../src/site-access';

interface ChromeMockOptions {
  origins?: string[];
  registered?: chrome.scripting.RegisteredContentScript[];
  migrated?: boolean;
  requestResult?: boolean;
}

function installChromeMock(options: ChromeMockOptions = {}) {
  const getAll = vi.fn(async () => ({ origins: options.origins ?? [], permissions: [] }));
  const remove = vi.fn(async () => true);
  const request = vi.fn(async () => options.requestResult ?? true);
  const storageGet = vi.fn(async () => ({
    anime4kGranularSiteAccessV1: options.migrated ?? false,
  }));
  const storageSet = vi.fn(async () => undefined);
  const getRegisteredContentScripts = vi.fn(async () => options.registered ?? []);
  const unregisterContentScripts = vi.fn(async (_filter: chrome.scripting.ContentScriptFilter) => undefined);
  const registerContentScripts = vi.fn(async (_scripts: chrome.scripting.RegisteredContentScript[]) => undefined);
  const executeScript = vi.fn(async (
    _injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
  ) => []);

  vi.stubGlobal('chrome', {
    permissions: {
      getAll,
      remove,
      request,
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
    request,
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

  it('migration is a no-op now that scripts are manifest-declared', async () => {
    const mock = installChromeMock({ origins: ['http://*/*', 'https://*/*'] });
    await migrateLegacyBroadSiteAccess();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.storageSet).not.toHaveBeenCalled();
  });

  it('does not register scripts dynamically; manifest handles injection', async () => {
    const mock = installChromeMock({ origins: ['https://video.example/*'] });
    await synchronizeRegisteredContentScripts();
    expect(mock.registerContentScripts).not.toHaveBeenCalled();
  });

  it('cleans up stale dynamic registrations from previous versions', async () => {
    const mock = installChromeMock({
      registered: [{ id: 'aniwebscale-content', matches: ['https://video.example/*'] }],
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

  it('reports full website access only when both broad origins are granted', async () => {
    installChromeMock({ origins: ['http://*/*', 'https://*/*'] });
    await expect(hasAllWebsiteAccess()).resolves.toBe(true);

    // The Firefox state after an update: only a leftover per-site grant
    // (e.g. Crunchyroll) survives, so the broad origins are not covered.
    installChromeMock({ origins: ['*://*.crunchyroll.com/*'] });
    await expect(hasAllWebsiteAccess()).resolves.toBe(false);

    installChromeMock({ origins: [] });
    await expect(hasAllWebsiteAccess()).resolves.toBe(false);
  });

  it('requests both broad origins at once when asking for website access', async () => {
    const mock = installChromeMock({ requestResult: true });
    await expect(requestAllWebsiteAccess()).resolves.toBe(true);
    expect(mock.request).toHaveBeenCalledWith({
      origins: ['http://*/*', 'https://*/*'],
    });
  });
});
