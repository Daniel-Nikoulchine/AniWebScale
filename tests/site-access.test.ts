import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeSiteAccess,
  grantSiteAccess,
  injectSiteScripts,
  revokeSiteAccess,
  revokeSiteAccessPatterns,
  sitePatternForUrl,
  synchronizeRegisteredContentScripts,
} from '../src/site-access';

interface ChromeMockOptions {
  origins?: string[];
  registered?: chrome.scripting.RegisteredContentScript[];
  requestGranted?: boolean;
  frames?: Partial<chrome.webNavigation.GetAllFrameResultDetails>[];
}

function installChromeMock(options: ChromeMockOptions = {}) {
  const stored: Record<string, unknown> = {};
  const getAll = vi.fn(async () => ({ origins: options.origins ?? [], permissions: [] }));
  const remove = vi.fn(async () => true);
  const request = vi.fn(async () => options.requestGranted ?? true);
  const sendMessage = vi.fn(async () => ({ ok: true }));
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
  const getAllFrames = vi.fn(async (_details: { tabId: number }) =>
    (options.frames ?? []) as chrome.webNavigation.GetAllFrameResultDetails[]);

  vi.stubGlobal('chrome', {
    permissions: {
      getAll,
      remove,
      request,
    },
    runtime: {
      sendMessage,
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
    webNavigation: {
      getAllFrames,
    },
  } as unknown as typeof chrome);

  return {
    executeScript,
    getAll,
    getAllFrames,
    getRegisteredContentScripts,
    registerContentScripts,
    remove,
    request,
    sendMessage,
    storageSet,
    unregisterContentScripts,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('site access', () => {
  it('reduces supported URLs to one portless origin pattern', () => {
    // Firefox rejects port numbers in match patterns, and Chrome reads a
    // portless host as matching any port, so grants must always be portless.
    expect(sitePatternForUrl('https://video.example:8443/watch?id=1')).toBe('https://video.example/*');
    expect(sitePatternForUrl('http://localhost:3000/player')).toBe('http://localhost/*');
    expect(sitePatternForUrl('https://video.example/watch')).toBe('https://video.example/*');
    expect(sitePatternForUrl('chrome://extensions')).toBeNull();
    expect(sitePatternForUrl(undefined)).toBeNull();
  });

  it('keeps legacy blanket grants working instead of leaving the extension inert', async () => {
    // Regression: users who upgraded from the blanket host_permissions era
    // must not end up with zero registered content scripts (and therefore a
    // silently dead extension) until they re-approve every site by hand.
    const mock = installChromeMock({ origins: ['http://*/*', 'https://*/*'] });
    await synchronizeRegisteredContentScripts();

    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.unregisterContentScripts).not.toHaveBeenCalled();
    const scripts = mock.registerContentScripts.mock.calls[0][0];
    expect(scripts).toHaveLength(2);
    expect(scripts[1]).toMatchObject({
      id: 'aniwebscale-content',
      matches: ['http://*/*', 'https://*/*'],
    });
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
    await expect(injectSiteScripts(42)).resolves.toBe(true);

    expect(mock.executeScript.mock.calls).toEqual([
      [{ target: { tabId: 42, allFrames: true }, files: ['fullscreen-bridge.js'], world: 'MAIN' }],
      [{ target: { tabId: 42, allFrames: true }, files: ['content.js'], world: 'ISOLATED' }],
    ]);
  });

  it('injects frame by frame when an unscriptable frame rejects the all-frames call', async () => {
    const mock = installChromeMock({
      frames: [
        { frameId: 0, url: 'https://stream.example/' },
        { frameId: 1, url: 'https://voe.sx/embed/abc' },
        { frameId: 2, url: 'https://ads.example/banner' },
      ],
    });
    mock.executeScript.mockImplementation(async injection => {
      if (injection.target.allFrames) throw new Error('Cannot access contents of the frame.');
      if (injection.target.frameIds?.[0] === 2) throw new Error('Cannot access contents of the frame.');
      return [];
    });

    await expect(injectSiteScripts(42)).resolves.toBe(true);

    // One fast-path all-frames attempt, rejected wholesale by the ad frame.
    expect(mock.executeScript.mock.calls[0][0]).toMatchObject({
      target: { tabId: 42, allFrames: true },
      files: ['fullscreen-bridge.js'],
    });
    // Every http(s) frame is then attempted individually, unscriptable ones
    // included, and skipped on failure.
    expect(mock.executeScript).toHaveBeenCalledTimes(1 + 3 * 2);
    const targets = mock.executeScript.mock.calls.slice(1).map(call => call[0].target);
    expect(targets.filter(target => target.frameIds?.[0] === 0)).toHaveLength(2);
    expect(targets.filter(target => target.frameIds?.[0] === 1)).toHaveLength(2);
    expect(targets.filter(target => target.frameIds?.[0] === 2)).toHaveLength(2);
    // The MAIN world bridge runs before the isolated content script in each frame.
    expect(mock.executeScript.mock.calls[1][0]).toMatchObject({
      target: { tabId: 42, frameIds: [0] },
      files: ['fullscreen-bridge.js'],
      world: 'MAIN',
    });
  });

  it('reports failure when frames cannot be enumerated after an all-frames rejection', async () => {
    const mock = installChromeMock();
    mock.executeScript.mockImplementation(async injection => {
      if (injection.target.allFrames) throw new Error('Cannot access contents of the frame.');
      return [];
    });
    mock.getAllFrames.mockRejectedValue(new Error('webNavigation unavailable'));

    await expect(injectSiteScripts(42)).resolves.toBe(false);
    expect(mock.executeScript).toHaveBeenCalledTimes(1);
  });

  it('reports failure when no injection succeeded', async () => {
    const mock = installChromeMock();
    mock.executeScript.mockRejectedValue(new Error('The tab was discarded.'));

    await expect(injectSiteScripts(42)).resolves.toBe(false);
    expect(mock.executeScript).toHaveBeenCalledTimes(1);
  });

  it('removes only well-formed http origin patterns', async () => {
    const mock = installChromeMock();
    await revokeSiteAccessPatterns(['https://video.example/*', 'chrome://extensions', 'https://video.example/*']);

    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith({ origins: ['https://video.example/*'] });
    expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'SITE_ACCESS_SYNC' });
  });

  it('classifies access as own, broad or none', async () => {
    installChromeMock({ origins: ['https://own.example/*'] });
    await expect(describeSiteAccess('https://own.example/watch')).resolves.toEqual({
      access: 'own',
      covering: [],
    });

    installChromeMock({ origins: ['http://*/*', 'https://*/*'] });
    await expect(describeSiteAccess('https://covered.example/watch')).resolves.toEqual({
      access: 'broad',
      covering: ['http://*/*', 'https://*/*'],
    });

    installChromeMock({ origins: [] });
    await expect(describeSiteAccess('https://unknown.example/watch')).resolves.toEqual({
      access: 'none',
      covering: [],
    });
    await expect(describeSiteAccess('chrome://extensions')).resolves.toBeNull();
  });

  it('grants, synchronizes the registration and injects in one operation', async () => {
    const mock = installChromeMock({ origins: [] });
    await expect(grantSiteAccess({ id: 7, url: 'https://video.example/watch' })).resolves.toBe('injected');

    expect(mock.request).toHaveBeenCalledWith({ origins: ['https://video.example/*'] });
    expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'SITE_ACCESS_SYNC' });
    expect(mock.executeScript).toHaveBeenCalled();
  });

  it('auto-grants cross-origin player frames alongside the main site', async () => {
    const mock = installChromeMock({
      origins: [],
      frames: [
        { frameId: 0, url: 'https://aniworld.to/watch/episode' },
        { frameId: 1, url: 'https://voe.sx/embed/abc123' },
        { frameId: 2, url: 'https://ads.example/tracker' },
      ],
    });
    await expect(grantSiteAccess({ id: 7, url: 'https://aniworld.to/watch/episode' })).resolves.toBe('injected');

    // The request should include both the main site and every cross-origin frame.
    expect(mock.request).toHaveBeenCalledWith({
      origins: ['https://aniworld.to/*', 'https://voe.sx/*', 'https://ads.example/*'],
    });
    expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'SITE_ACCESS_SYNC' });
    expect(mock.executeScript).toHaveBeenCalled();
  });

  it('reports reload-required when the grant persists but injection is impossible', async () => {
    const mock = installChromeMock({ origins: [] });
    mock.executeScript.mockRejectedValue(new Error('The tab was discarded.'));

    await expect(grantSiteAccess({ id: 7, url: 'https://video.example/watch' })).resolves.toBe('reload-required');
    expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'SITE_ACCESS_SYNC' });
  });

  it('denies the grant operation without touching registration or injection', async () => {
    const mock = installChromeMock({ origins: [], requestGranted: false });
    await expect(grantSiteAccess({ id: 7, url: 'https://video.example/watch' })).resolves.toBe('denied');

    expect(mock.sendMessage).not.toHaveBeenCalled();
    expect(mock.executeScript).not.toHaveBeenCalled();
    await expect(grantSiteAccess({ url: 'https://video.example/watch' })).resolves.toBe('denied');
  });

  it('revokes an own grant and a broad grant through the same operation', async () => {
    const own = installChromeMock({ origins: ['https://own.example/*'] });
    await expect(revokeSiteAccess('https://own.example/watch')).resolves.toBe(true);
    expect(own.remove).toHaveBeenCalledWith({ origins: ['https://own.example/*'] });
    expect(own.sendMessage).toHaveBeenCalledWith({ type: 'SITE_ACCESS_SYNC' });

    const broad = installChromeMock({ origins: ['http://*/*', 'https://*/*'] });
    await expect(revokeSiteAccess('https://covered.example/watch')).resolves.toBe(true);
    expect(broad.remove).toHaveBeenCalledWith({ origins: ['http://*/*', 'https://*/*'] });

    const none = installChromeMock({ origins: [] });
    await expect(revokeSiteAccess('https://unknown.example/watch')).resolves.toBe(false);
    expect(none.remove).not.toHaveBeenCalled();
  });
});
