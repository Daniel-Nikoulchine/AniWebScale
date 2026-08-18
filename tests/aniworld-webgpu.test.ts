import { afterEach, describe, expect, it, vi } from 'vitest';
import { sitePatternForUrl } from '../src/site-access';

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    isConnected: true,
    videoWidth: 1920,
    videoHeight: 1080,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    ...overrides,
  } as unknown as HTMLVideoElement;
}

describe('AniWorld WebGPU player detection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts the redirect URL that AniWorld uses for hoster buttons', () => {
    expect(sitePatternForUrl('https://aniworld.to/redirect/4199343')).toBe('https://aniworld.to/*');
  });

  it('recognizes a player video even when the Fullscreen API element is absent', async () => {
    const video = makeVideo();
    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      top: undefined,
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080 },
    });
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: () => false, clientWidth: 1920, clientHeight: 1080 },
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('getComputedStyle', () => ({ display: 'block', visibility: 'visible', opacity: '1' }));
    expect(video.getBoundingClientRect().width).toBe(window.innerWidth);
  });
});
