import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fullscreenContainsVideo,
  getAuthoritativeFullscreenElement,
  hasFullscreenContext,
  isFullscreenVideoEligible,
  isVideoInFullscreenContext,
  rectOccupiesViewport,
  resetFullscreenApiTracking,
  videoFillsOwnViewport,
  viewportOccupiesScreen,
} from '../src/shared/fullscreen-video';

afterEach(() => {
  resetFullscreenApiTracking();
  vi.unstubAllGlobals();
});

describe('fullscreen video selection', () => {
  it('selects only a video inside the fullscreen subtree', () => {
    const player = { parentNode: null, getRootNode: () => null } as unknown as Element;
    const video = { parentNode: player } as unknown as HTMLVideoElement;
    const other = { parentNode: null, getRootNode: () => null } as unknown as HTMLVideoElement;
    expect(fullscreenContainsVideo(player, video)).toBe(true);
    expect(fullscreenContainsVideo(player, other)).toBe(false);
    expect(fullscreenContainsVideo(null, video)).toBe(false);
  });

  it('keeps the active source eligible when the renderer hides it behind its canvas', () => {
    const style = {
      display: 'block',
      visibility: 'visible',
      opacity: '0',
    };
    vi.stubGlobal('getComputedStyle', () => style);
    const fullscreen = { parentNode: null } as unknown as Element;
    const attributes = new Map([['data-anime4k-applied', 'true']]);
    const video = {
      parentNode: fullscreen,
      isConnected: true,
      getBoundingClientRect: () => ({ width: 1280, height: 720 }),
      getAttribute: (name: string) => attributes.get(name) ?? null,
    } as unknown as HTMLVideoElement;

    expect(isFullscreenVideoEligible(fullscreen, video)).toBe(true);
    style.display = 'none';
    expect(isFullscreenVideoEligible(fullscreen, video)).toBe(false);
    style.display = 'block';
    attributes.delete('data-anime4k-applied');
    expect(isFullscreenVideoEligible(fullscreen, video)).toBe(false);
  });
});

describe('fullscreen geometry fallback', () => {
  it('accepts a viewport and video that cover the physical screen', () => {
    const viewport = { width: 1920, height: 1080 };
    expect(viewportOccupiesScreen(viewport, {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
    })).toBe(true);
    expect(rectOccupiesViewport({
      left: 0,
      top: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
    }, viewport)).toBe(true);
  });

  it('rejects a maximized browser viewport with visible browser chrome', () => {
    expect(viewportOccupiesScreen(
      { width: 1920, height: 900 },
      { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    )).toBe(false);
  });

  it('keeps a terminal native failure blocked while fullscreen remains active', () => {
    const viewport = { width: 1920, height: 900 };
    const display = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 };
    expect(hasFullscreenContext({} as Element, viewport, display)).toBe(true);
    expect(hasFullscreenContext(null, { width: 1920, height: 1080 }, display)).toBe(true);
    expect(hasFullscreenContext(null, { width: 1920, height: 1080 }, display, false)).toBe(false);
    expect(hasFullscreenContext(null, viewport, display)).toBe(false);
  });

  it('rejects a video that does not fill the fullscreen frame', () => {
    expect(rectOccupiesViewport({
      left: 320,
      top: 180,
      right: 1600,
      bottom: 900,
      width: 1280,
      height: 720,
    }, { width: 1920, height: 1080 })).toBe(false);
  });

  it('resolves the top-level fullscreen element from a cross-origin guest frame', () => {
    const topFullscreen = { tagName: 'DIV' } as unknown as Element;
    const guestWindow = {
      top: {
        document: { fullscreenElement: topFullscreen, webkitFullscreenElement: null },
      },
      document: { fullscreenElement: null, webkitFullscreenElement: null },
    };
    vi.stubGlobal('window', guestWindow);
    try {
      expect(getAuthoritativeFullscreenElement()).toBe(topFullscreen);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('treats a guest-frame video as fullscreen when the top document owns it', () => {
    const topFullscreen = { parentNode: null, getRootNode: () => null } as unknown as Element;
    const video = {
      parentNode: topFullscreen,
      isConnected: true,
      getBoundingClientRect: () => ({ width: 1280, height: 720 }),
      getAttribute: () => null,
    } as unknown as HTMLVideoElement;
    const guestWindow = {
      top: {
        document: { fullscreenElement: topFullscreen, webkitFullscreenElement: null },
        screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
        documentElement: { clientWidth: 1920, clientHeight: 1080 },
      },
      document: { fullscreenElement: null, webkitFullscreenElement: null },
    };
    vi.stubGlobal('window', guestWindow);
    vi.stubGlobal('getComputedStyle', () => ({
      display: 'block', visibility: 'visible', opacity: '1', transform: 'none',
    }));
    try {
      expect(isVideoInFullscreenContext(video)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to local geometry when the cross-origin top window denies access', () => {
    // Reading any property of a cross-origin window.top throws; the
    // geometry fallback must use local metrics instead of rejecting.
    const video = {
      parentNode: null,
      isConnected: true,
      getBoundingClientRect: () => ({
        left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080,
      }),
      getAttribute: () => null,
    } as unknown as HTMLVideoElement;
    const crossOriginTop: Record<string, unknown> = {};
    Object.defineProperty(crossOriginTop, 'document', {
      get() { throw new TypeError('Permission denied to access property "document"'); },
    });
    vi.stubGlobal('window', {
      top: crossOriginTop,
      document: { fullscreenElement: null, webkitFullscreenElement: null },
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    });
    vi.stubGlobal('screen', { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 });
    vi.stubGlobal('document', {
      fullscreenElement: null,
      webkitFullscreenElement: null,
      documentElement: { hasAttribute: () => false },
    });
    vi.stubGlobal('getComputedStyle', () => ({
      display: 'block', visibility: 'visible', opacity: '1',
    }));
    try {
      expect(isVideoInFullscreenContext(video)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts a top-level CSS-fullscreen video without a Fullscreen API element', () => {
    const video = {
      parentNode: null,
      isConnected: true,
      getBoundingClientRect: () => ({
        left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080,
      }),
      getAttribute: () => null,
    } as unknown as HTMLVideoElement;
    vi.stubGlobal('window', {
      top: undefined,
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    });
    vi.stubGlobal('screen', { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 });
    vi.stubGlobal('document', {
      fullscreenElement: null,
      webkitFullscreenElement: null,
      documentElement: { hasAttribute: () => false, clientWidth: 1920, clientHeight: 1080 },
    });
    vi.stubGlobal('getComputedStyle', () => ({
      display: 'block', visibility: 'visible', opacity: '1',
    }));
    try {
      expect(isVideoInFullscreenContext(video)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks the geometry fallback when the extension layout is active on a top-level page', () => {
    const video = {
      parentNode: null,
      isConnected: true,
      getBoundingClientRect: () => ({
        left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080,
      }),
      getAttribute: () => null,
    } as unknown as HTMLVideoElement;
    const topWindow: Record<string, unknown> = {
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    };
    topWindow.top = topWindow;
    vi.stubGlobal('window', topWindow);
    vi.stubGlobal('screen', { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 });
    vi.stubGlobal('document', {
      fullscreenElement: null,
      webkitFullscreenElement: null,
      documentElement: {
        hasAttribute: (name: string) => name === 'data-anime4k-fullscreen-document',
        clientWidth: 1920,
        clientHeight: 1080,
      },
    });
    vi.stubGlobal('getComputedStyle', () => ({
      display: 'block', visibility: 'visible', opacity: '1',
    }));
    try {
      expect(isVideoInFullscreenContext(video)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('blocks the geometry fallback once after the Fullscreen API exits, then allows it again', () => {
    const video = {
      parentNode: null,
      getRootNode: () => null,
      isConnected: true,
      getBoundingClientRect: () => ({
        left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080,
      }),
      getAttribute: () => null,
    } as unknown as HTMLVideoElement;
    const topWindow: Record<string, unknown> = {
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    };
    topWindow.top = topWindow;
    vi.stubGlobal('window', topWindow);
    vi.stubGlobal('screen', { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 });
    // First call: fullscreen is active, API usage is recorded.
    const fullscreenEl = { parentNode: null, getRootNode: () => null } as unknown as Element;
    vi.stubGlobal('document', {
      fullscreenElement: fullscreenEl,
      webkitFullscreenElement: null,
      documentElement: { hasAttribute: () => false, clientWidth: 1920, clientHeight: 1080 },
    });
    vi.stubGlobal('getComputedStyle', () => ({
      display: 'block', visibility: 'visible', opacity: '1',
    }));
    try {
      // Video is not inside the fullscreen element, so this returns false,
      // but fullscreenApiActive is now set to true.
      isVideoInFullscreenContext(video);
      // Second call: fullscreen exited (null), geometry would pass but must be blocked.
      vi.stubGlobal('document', {
        fullscreenElement: null,
        webkitFullscreenElement: null,
        documentElement: { hasAttribute: () => false, clientWidth: 1920, clientHeight: 1080 },
      });
      expect(isVideoInFullscreenContext(video)).toBe(false);
      // Third call: flag was reset, geometry fallback is allowed again (CSS fullscreen).
      expect(isVideoInFullscreenContext(video)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('videoFillsOwnViewport (embedded hoster players)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function frameVideo(rect: {
    left: number; top: number; width: number; height: number;
  }): HTMLVideoElement {
    return {
      isConnected: true,
      getBoundingClientRect: () => ({
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }),
    } as unknown as HTMLVideoElement;
  }

  function installHosterFrameViewport(style: Record<string, string> = {
    display: 'block', visibility: 'visible', opacity: '1',
  }): void {
    vi.stubGlobal('window', { top: undefined, innerWidth: 870, innerHeight: 490 });
    vi.stubGlobal('getComputedStyle', () => style);
  }

  it('accepts a video that covers its own frame viewport', () => {
    installHosterFrameViewport();
    expect(videoFillsOwnViewport(frameVideo({ left: 0, top: 0, width: 870, height: 490 }))).toBe(true);
    expect(videoFillsOwnViewport(frameVideo({ left: 20, top: 16, width: 840, height: 470 }))).toBe(true);
  });

  it('rejects a video that only partially occupies its frame', () => {
    installHosterFrameViewport();
    expect(videoFillsOwnViewport(frameVideo({ left: 100, top: 300, width: 640, height: 360 }))).toBe(false);
    expect(videoFillsOwnViewport(frameVideo({ left: 0, top: 0, width: 400, height: 220 }))).toBe(false);
  });

  it('rejects hidden videos and detached videos', () => {
    installHosterFrameViewport({ display: 'none', visibility: 'visible', opacity: '1' });
    expect(videoFillsOwnViewport(frameVideo({ left: 0, top: 0, width: 870, height: 490 }))).toBe(false);
    const detached = { ...frameVideo({ left: 0, top: 0, width: 870, height: 490 }), isConnected: false };
    expect(videoFillsOwnViewport(detached as unknown as HTMLVideoElement)).toBe(false);
  });
});
