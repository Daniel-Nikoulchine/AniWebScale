import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fullscreenContainsVideo,
  hasFullscreenContext,
  isFullscreenVideoEligible,
  rectOccupiesViewport,
  viewportOccupiesScreen,
} from '../src/shared/fullscreen-video';

afterEach(() => vi.unstubAllGlobals());

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
});
