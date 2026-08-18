import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IframeSiteAccessManager, type IframeSiteAccessDeps } from '../src/background/iframe-site-access';
import { iframeOriginForAccess, looksLikeEmbeddedPlayer } from '../src/core/iframe-site-access';

// ── iframeOriginForAccess ────────────────────────────────────────────────

function fakeIframe(src: string | null): HTMLIFrameElement {
  return {
    tagName: 'IFRAME',
    getAttribute: () => src,
    src: src ?? '',
  } as unknown as HTMLIFrameElement;
}

describe('iframeOriginForAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts the origin from an http(s) iframe src', () => {
    expect(iframeOriginForAccess(fakeIframe('https://voe.sx/embed/abc123'))).toBe('https://voe.sx');
    expect(iframeOriginForAccess(fakeIframe('http://localhost:3000/player'))).toBe('http://localhost:3000');
  });

  it('resolves relative src against the page location', () => {
    vi.stubGlobal('location', { href: 'https://aniworld.to/to/xyz' });
    expect(iframeOriginForAccess(fakeIframe('/player/embed'))).toBe('https://aniworld.to');
  });

  it('returns null for missing or non-grantable src', () => {
    expect(iframeOriginForAccess(fakeIframe(null))).toBeNull();
    expect(iframeOriginForAccess(fakeIframe(''))).toBeNull();
    expect(iframeOriginForAccess(fakeIframe('about:blank'))).toBeNull();
    expect(iframeOriginForAccess(fakeIframe('data:text/html,hi'))).toBeNull();
    expect(iframeOriginForAccess(fakeIframe('chrome://settings'))).toBeNull();
    expect(iframeOriginForAccess(fakeIframe('not a url'))).toBeNull();
  });
});

// ── looksLikeEmbeddedPlayer ──────────────────────────────────────────────

interface Rect {
  width: number;
  height: number;
}

function sizedIframe(src: string, rect: Rect): HTMLIFrameElement {
  return {
    tagName: 'IFRAME',
    getAttribute: () => src,
    src,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: rect.width,
      bottom: rect.height,
      width: rect.width,
      height: rect.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLIFrameElement;
}

describe('looksLikeEmbeddedPlayer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function installAppearanceGlobals(style: Record<string, string> = {
    display: 'block', visibility: 'visible', opacity: '1',
  }): void {
    vi.stubGlobal('location', { href: 'https://aniworld.to/to/episode', origin: 'https://aniworld.to' });
    vi.stubGlobal('getComputedStyle', () => style);
  }

  it('accepts a player-sized cross-origin iframe', () => {
    installAppearanceGlobals();
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://voe.sx/e/abc', { width: 870, height: 490 }))).toBe(true);
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://vidmoly.to/stream/xyz', { width: 640, height: 360 }))).toBe(true);
  });

  it('rejects standard ad sizes and extreme aspect ratios', () => {
    installAppearanceGlobals();
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://ads.example.com/mpu', { width: 300, height: 250 }))).toBe(false);
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://ads.example.com/leader', { width: 728, height: 90 }))).toBe(false);
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://panel.example.com/side', { width: 400, height: 900 }))).toBe(false);
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://voe.sx/e/abc', { width: 0, height: 0 }))).toBe(false);
  });

  it('rejects same-origin iframes and hidden players', () => {
    installAppearanceGlobals({ display: 'none', visibility: 'visible', opacity: '1' });
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://aniworld.to/player', { width: 870, height: 490 }))).toBe(false);
    expect(looksLikeEmbeddedPlayer(sizedIframe('/embed/same-origin', { width: 870, height: 490 }))).toBe(false);
    expect(looksLikeEmbeddedPlayer(sizedIframe('https://voe.sx/e/abc', { width: 870, height: 490 }))).toBe(false);
  });
});

// ── IframeSiteAccessManager ──────────────────────────────────────────────

function installDeps(overrides: Partial<IframeSiteAccessDeps> = {}) {
  let clock = 1000;
  const deps: IframeSiteAccessDeps = {
    contains: vi.fn(async () => false),
    request: vi.fn(async () => true),
    synchronize: vi.fn(async () => undefined),
    inject: vi.fn(async () => true),
    notify: vi.fn(),
    openGrantPage: vi.fn(),
    now: vi.fn(() => clock),
    ...overrides,
  };
  const advance = (ms: number): void => {
    clock += ms;
  };
  return { deps, advance, manager: new IframeSiteAccessManager(deps, 10_000, 45_000) };
}

describe('IframeSiteAccessManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects immediately when the player origin is already granted', async () => {
    const { deps, manager } = installDeps({ contains: vi.fn(async () => true) });
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'injected' });
    expect(deps.inject).toHaveBeenCalledWith(7);
    expect(deps.request).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('prompts, then synchronizes and injects on grant', async () => {
    const { deps, manager } = installDeps();
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'prompting' });
    expect(deps.request).toHaveBeenCalledWith(['https://voe.sx/*']);
    await manager.settled();
    expect(deps.synchronize).toHaveBeenCalled();
    expect(deps.inject).toHaveBeenCalledWith(7);
    expect(deps.notify).toHaveBeenCalledWith(7, 'https://voe.sx', 'granted', true);
  });

  it('reports a denial without touching the registration', async () => {
    const { deps, manager } = installDeps({ request: vi.fn(async () => false) });
    await manager.handle('https://voe.sx', 7);
    await manager.settled();
    expect(deps.notify).toHaveBeenCalledWith(7, 'https://voe.sx', 'denied');
    expect(deps.synchronize).not.toHaveBeenCalled();
    expect(deps.inject).not.toHaveBeenCalled();
  });

  it('reports applied=false when the injection fails after a grant', async () => {
    const { deps, manager } = installDeps({
      inject: vi.fn(async () => { throw new Error('The tab was discarded.'); }),
    });
    await manager.handle('https://voe.sx', 7);
    await manager.settled();
    expect(deps.synchronize).toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledWith(7, 'https://voe.sx', 'granted', false);
  });

  it('falls back to the grant page when the prompt cannot be shown', async () => {
    const { deps, manager } = installDeps({ request: vi.fn(async () => { throw new Error('user gesture'); }) });
    await manager.handle('https://voe.sx', 7);
    await manager.settled();
    expect(deps.openGrantPage).toHaveBeenCalledWith('https://voe.sx', 7);
    expect(deps.notify).toHaveBeenCalledWith(7, 'https://voe.sx', 'failed');
  });

  it('suppresses repeat prompts while one is pending', async () => {
    let resolveRequest: (granted: boolean) => void = () => undefined;
    const { deps, manager } = installDeps({
      request: vi.fn(() => new Promise<boolean>(resolve => { resolveRequest = resolve; })),
    });
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'prompting' });
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'suppressed' });
    resolveRequest(false);
    await manager.settled();
    expect(deps.request).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith(7, 'https://voe.sx', 'denied');
  });

  it('suppresses prompt spam within the cooldown window', async () => {
    const { deps, advance, manager } = installDeps({ request: vi.fn(async () => false) });
    await manager.handle('https://voe.sx', 7);
    await manager.settled();
    advance(3000);
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'suppressed' });
    expect(deps.request).toHaveBeenCalledTimes(1);
    advance(8000);
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'prompting' });
    await manager.settled();
    expect(deps.request).toHaveBeenCalledTimes(2);
  });

  it('treats an abandoned pending prompt as stale and prompts again', async () => {
    let resolveRequest: (granted: boolean) => void = () => undefined;
    const { advance, manager } = installDeps({
      request: vi.fn(() => new Promise<boolean>(resolve => { resolveRequest = resolve; })),
    });
    await manager.handle('https://voe.sx', 7);
    resolveRequest(false);
    await manager.settled();
    advance(50_000);
    await expect(manager.handle('https://voe.sx', 7)).resolves.toEqual({ ok: true, outcome: 'prompting' });
  });

  it('rejects origins that cannot be granted', async () => {
    const { deps, manager } = installDeps();
    await expect(manager.handle('chrome://settings', 7)).resolves.toEqual({
      ok: false,
      message: 'Unsupported player origin.',
    });
    expect(deps.request).not.toHaveBeenCalled();
  });

  it('grants even when the sender has no tab (registration covers the next load)', async () => {
    const { deps, manager } = installDeps();
    await manager.handle('https://voe.sx');
    await manager.settled();
    expect(deps.synchronize).toHaveBeenCalled();
    expect(deps.inject).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });
});

// ── installIframeSiteAccessProbe ─────────────────────────────────────────
//
// The probe guards itself with a module-level install flag, so every test
// re-imports a fresh module copy via vi.resetModules() and dynamic import.

interface ProbeHarness {
  handlers: Record<string, () => void>;
  exitFullscreen: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
}

async function freshProbeModule(): Promise<typeof import('../src/core/iframe-site-access')> {
  vi.resetModules();
  return await import('../src/core/iframe-site-access');
}

function installProbeHarness(
  install: () => void,
  fullscreenElement: unknown,
  sendResponse: unknown,
): ProbeHarness {
  const handlers: Record<string, () => void> = {};
  const exitFullscreen = vi.fn(() => Promise.resolve());
  const sendMessage = vi.fn(async () => sendResponse);
  vi.stubGlobal('document', {
    addEventListener: vi.fn((name: string, handler: () => void) => {
      handlers[name] = handler;
    }),
    fullscreenElement,
    exitFullscreen,
  });
  vi.stubGlobal('window', { top: undefined });
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
    storage: { local: { get: vi.fn(async () => ({ extensionEnabled: true })) } },
  });
  vi.stubGlobal('location', { href: 'https://aniworld.to/' });
  install();
  return { handlers, exitFullscreen, sendMessage };
}

describe('installIframeSiteAccessProbe', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exits fullscreen when the background answers prompting', async () => {
    const probe = await freshProbeModule();
    const iframe = fakeIframe('https://voe.sx/embed/abc');
    const { handlers, exitFullscreen, sendMessage } = installProbeHarness(
      probe.installIframeSiteAccessProbe,
      iframe,
      { ok: true, outcome: 'prompting' },
    );
    handlers['fullscreenchange']?.();
    await vi.waitFor(() => expect(exitFullscreen).toHaveBeenCalled());
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SITE_ACCESS_IFRAME_REQUEST',
      origin: 'https://voe.sx',
    });
  });

  it('stays in fullscreen when access is already applied', async () => {
    const probe = await freshProbeModule();
    const { handlers, exitFullscreen } = installProbeHarness(
      probe.installIframeSiteAccessProbe,
      fakeIframe('https://voe.sx/embed/abc'),
      { ok: true, outcome: 'injected' },
    );
    handlers['fullscreenchange']?.();
    await vi.waitFor(() => expect(exitFullscreen).not.toHaveBeenCalled());
  });

  it('ignores non-iframe fullscreen elements', async () => {
    const probe = await freshProbeModule();
    const { handlers, sendMessage } = installProbeHarness(
      probe.installIframeSiteAccessProbe,
      { tagName: 'VIDEO' },
      undefined,
    );
    handlers['fullscreenchange']?.();
    await vi.waitFor(() => expect(sendMessage).not.toHaveBeenCalled());
  });

  it('stays silent while the extension is disabled', async () => {
    const probe = await freshProbeModule();
    const { handlers, sendMessage } = installProbeHarness(
      probe.installIframeSiteAccessProbe,
      fakeIframe('https://voe.sx/embed/abc'),
      { ok: true, outcome: 'prompting' },
    );
    vi.stubGlobal('chrome', {
      runtime: { sendMessage },
      storage: { local: { get: vi.fn(async () => ({ extensionEnabled: false })) } },
    });
    handlers['fullscreenchange']?.();
    await vi.waitFor(() => expect(sendMessage).not.toHaveBeenCalled());
  });
});

// ── installIframeSiteAccessProbe — embedded player appearance ────────────
//
// AniWorld leaves the player iframe empty at load and points it at the
// hoster (VOE, Doodstream, Filemoon, Vidmoly) only after a hoster button
// was clicked. The probe must pick that up from DOM mutations, without any
// fullscreen involvement.

interface AppearanceHarness {
  triggerMutation: () => void;
  exitFullscreen: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
}

function installAppearanceHarness(
  install: () => void,
  iframes: () => HTMLIFrameElement[],
  sendResponse: unknown,
): AppearanceHarness {
  let mutationCallback: (() => void) | undefined;
  class FakeMutationObserver {
    public constructor(callback: () => void) {
      mutationCallback = callback;
    }

    public observe = vi.fn();
    public disconnect = vi.fn();
  }
  const sendMessage = vi.fn(async () => sendResponse);
  const exitFullscreen = vi.fn(() => Promise.resolve());
  vi.stubGlobal('MutationObserver', FakeMutationObserver);
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    fullscreenElement: null,
    exitFullscreen,
    documentElement: { tagName: 'HTML' },
    querySelectorAll: vi.fn(() => iframes()),
  });
  vi.stubGlobal('window', { top: undefined });
  vi.stubGlobal('location', { href: 'https://aniworld.to/to/episode', origin: 'https://aniworld.to' });
  vi.stubGlobal('getComputedStyle', () => ({ display: 'block', visibility: 'visible', opacity: '1' }));
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
    storage: { local: { get: vi.fn(async () => ({ extensionEnabled: true })) } },
  });
  install();
  return {
    triggerMutation: () => mutationCallback?.(),
    exitFullscreen,
    sendMessage,
  };
}

describe('installIframeSiteAccessProbe (embedded player appearance)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Let the probe's async settings read settle before asserting a no-send. */
  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  it('reports a hoster iframe that appears after the hoster was clicked', async () => {
    const probe = await freshProbeModule();
    let iframes: HTMLIFrameElement[] = [];
    const harness = installAppearanceHarness(
      probe.installIframeSiteAccessProbe,
      () => iframes,
      { ok: true, outcome: 'prompting' },
    );
    iframes = [sizedIframe('https://voe.sx/e/abc123', { width: 870, height: 490 })];
    harness.triggerMutation();
    await vi.waitFor(() => expect(harness.sendMessage).toHaveBeenCalledWith({
      type: 'SITE_ACCESS_IFRAME_REQUEST',
      origin: 'https://voe.sx',
    }));
    // Embedded reporting never leaves fullscreen: there is none.
    expect(harness.exitFullscreen).not.toHaveBeenCalled();
  });

  it('ignores ad-sized and same-origin iframes', async () => {
    const probe = await freshProbeModule();
    const harness = installAppearanceHarness(
      probe.installIframeSiteAccessProbe,
      () => [
        sizedIframe('https://ads.example.com/mpu', { width: 300, height: 250 }),
        sizedIframe('https://ads.example.com/leader', { width: 728, height: 90 }),
        sizedIframe('https://aniworld.to/player', { width: 870, height: 490 }),
      ],
      { ok: true, outcome: 'prompting' },
    );
    harness.triggerMutation();
    await settle();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('reports each hoster origin once and dedupes repeats', async () => {
    const probe = await freshProbeModule();
    const iframes = [
      sizedIframe('https://voe.sx/e/abc', { width: 870, height: 490 }),
      sizedIframe('https://doodstream.com/e/xyz', { width: 870, height: 490 }),
    ];
    const harness = installAppearanceHarness(
      probe.installIframeSiteAccessProbe,
      () => iframes,
      { ok: true, outcome: 'injected' },
    );
    harness.triggerMutation();
    await vi.waitFor(() => expect(harness.sendMessage).toHaveBeenCalledTimes(2));
    harness.triggerMutation();
    await settle();
    expect(harness.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('re-reports an origin after the dedupe window', async () => {
    vi.useFakeTimers();
    const probe = await freshProbeModule();
    const harness = installAppearanceHarness(
      probe.installIframeSiteAccessProbe,
      () => [sizedIframe('https://voe.sx/e/abc', { width: 870, height: 490 })],
      { ok: true, outcome: 'injected' },
    );
    harness.triggerMutation();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.sendMessage).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 31_000);
    harness.triggerMutation();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('re-checks an iframe whose layout settles after its src arrives', async () => {
    vi.useFakeTimers();
    const probe = await freshProbeModule();
    let sized = false;
    const iframe = {
      tagName: 'IFRAME',
      getAttribute: () => 'https://voe.sx/e/abc123',
      src: 'https://voe.sx/e/abc123',
      getBoundingClientRect: () => (sized
        ? { left: 0, top: 0, right: 870, bottom: 490, width: 870, height: 490, x: 0, y: 0, toJSON: () => ({}) }
        : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }),
    } as unknown as HTMLIFrameElement;
    const harness = installAppearanceHarness(
      probe.installIframeSiteAccessProbe,
      () => [iframe],
      { ok: true, outcome: 'injected' },
    );
    // Install-time scan sees the 0x0 pre-layout box and schedules a re-check.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.sendMessage).not.toHaveBeenCalled();
    sized = true;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.sendMessage).toHaveBeenCalledWith({
      type: 'SITE_ACCESS_IFRAME_REQUEST',
      origin: 'https://voe.sx',
    });
  });
});
