import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  injectSiteScripts,
  migrateLegacyBroadSiteAccess,
  sitePatternForUrl,
  synchronizeRegisteredContentScripts,
} from '../src/site-access';

interface ChromeMockOptions {
  origins?: string[];
  registered?: chrome.scripting.RegisteredContentScript[];
  migrated?: boolean;
}

function installChromeMock(options: ChromeMockOptions = {}) {
  const getAll = vi.fn(async () => ({ origins: options.origins ?? [], permissions: [] }));
  const remove = vi.fn(async () => true);
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

  it('removes legacy all-sites grants only during the one-time migration', async () => {
    const first = installChromeMock({ origins: ['http://*/*', 'https://*/*'] });
    await migrateLegacyBroadSiteAccess();

    expect(first.remove).toHaveBeenCalledWith({ origins: ['http://*/*', 'https://*/*'] });
    expect(first.storageSet).toHaveBeenCalledWith({ anime4kGranularSiteAccessV1: true });

    vi.unstubAllGlobals();
    const migrated = installChromeMock({ origins: ['https://*/*'], migrated: true });
    await migrateLegacyBroadSiteAccess();
    expect(migrated.remove).not.toHaveBeenCalled();
  });

  it('registers both scripts only for explicitly granted origins', async () => {
    const mock = installChromeMock({ origins: ['https://video.example/*'] });
    await synchronizeRegisteredContentScripts();

    expect(mock.registerContentScripts).toHaveBeenCalledOnce();
    const scripts = mock.registerContentScripts.mock.calls[0][0];
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toMatchObject({
      id: 'aniwebscale-fullscreen-bridge',
      matches: ['https://video.example/*'],
      world: 'MAIN',
      runAt: 'document_start',
    });
    expect(scripts[1]).toMatchObject({
      id: 'aniwebscale-content',
      matches: ['https://video.example/*'],
      world: 'ISOLATED',
      runAt: 'document_idle',
    });
  });

  it('unregisters stale scripts after the final site grant is removed', async () => {
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
});
