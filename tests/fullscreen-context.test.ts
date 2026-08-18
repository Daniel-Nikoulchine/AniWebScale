import { afterEach, describe, expect, it, vi } from 'vitest';
import { electFullscreenCandidate } from '../src/core/fullscreen-context';
import type { FullscreenCandidate } from '../src/core/fullscreen-context';
import { resetFullscreenApiTracking } from '../src/shared/fullscreen-video';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function videoCandidate(videoId: string, rect: Rect, parentNode: Element | null = null): FullscreenCandidate {
  return {
    videoId,
    video: {
      parentNode,
      isConnected: true,
      getRootNode: () => null,
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
      getAttribute: () => null,
    } as unknown as HTMLVideoElement,
  };
}

/**
 * The AniWorld hoster-frame scenario: the video lives in a cross-origin
 * player iframe whose viewport is much smaller than the physical screen, and
 * the top document denies every property read. isVideoInFullscreenContext
 * must be false there; only the own-viewport signal can elect the video.
 */
function installCrossOriginHosterFrame(): void {
  const crossOriginTop: Record<string, unknown> = {};
  Object.defineProperty(crossOriginTop, 'document', {
    get() {
      throw new TypeError('Permission denied to access property "document"');
    },
  });
  vi.stubGlobal('window', {
    top: crossOriginTop,
    document: { fullscreenElement: null, webkitFullscreenElement: null },
    innerWidth: 870,
    innerHeight: 490,
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
  });
  vi.stubGlobal('screen', { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 });
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    fullscreenElement: null,
    webkitFullscreenElement: null,
    documentElement: { hasAttribute: () => false },
  });
  vi.stubGlobal('getComputedStyle', () => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
  }));
}

afterEach(() => {
  resetFullscreenApiTracking();
  vi.unstubAllGlobals();
});

describe('electFullscreenCandidate', () => {
  it('elects an embedded hoster video that fills its own frame viewport', () => {
    installCrossOriginHosterFrame();
    const embeddedPlayer = videoCandidate('video-1', { left: 0, top: 0, width: 870, height: 490 });
    const inlinePreview = videoCandidate('video-2', { left: 24, top: 520, width: 300, height: 170 });
    expect(electFullscreenCandidate([embeddedPlayer, inlinePreview])).toBe(embeddedPlayer);
  });

  it('prefers the larger rendered area over an embedded player signal', () => {
    installCrossOriginHosterFrame();
    const embeddedPlayer = videoCandidate('video-1', { left: 0, top: 0, width: 870, height: 490 });
    const topFullscreenStage = { parentNode: null, getRootNode: () => null } as unknown as Element;
    const fullscreenVideo = videoCandidate('video-2', { left: 0, top: 0, width: 1280, height: 720 }, topFullscreenStage);
    vi.stubGlobal('window', {
      top: {
        document: { fullscreenElement: topFullscreenStage, webkitFullscreenElement: null },
      },
      document: { fullscreenElement: null, webkitFullscreenElement: null },
      innerWidth: 870,
      innerHeight: 490,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    });
    expect(electFullscreenCandidate([embeddedPlayer, fullscreenVideo])).toBe(fullscreenVideo);
  });

  it('returns null when no candidate has a fullscreen or player signal', () => {
    installCrossOriginHosterFrame();
    const smallInline = videoCandidate('video-1', { left: 24, top: 24, width: 640, height: 360 });
    expect(electFullscreenCandidate([smallInline])).toBeNull();
  });

  it('breaks a tie by the lower video id', () => {
    installCrossOriginHosterFrame();
    const later = videoCandidate('video-b', { left: 0, top: 0, width: 870, height: 490 });
    const earlier = videoCandidate('video-a', { left: 0, top: 0, width: 870, height: 490 });
    expect(electFullscreenCandidate([later, earlier])).toBe(earlier);
  });
});
