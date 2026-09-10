import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPlausiblePlayerSurface,
  playerAncestorPath,
  selectNativeCaptureSurfaceScope,
} from '../src/shared/player-surface';

afterEach(() => vi.unstubAllGlobals());

describe('fullscreen player surface selection', () => {
  it('accepts a compact player with controls but rejects a whole page', () => {
    const video = { width: 2048, height: 875 };
    expect(isPlausiblePlayerSurface(video, { width: 2048, height: 950 })).toBe(true);
    expect(isPlausiblePlayerSurface(video, { width: 2048, height: 1152 })).toBe(false);
  });

  it('uses the local fullscreen surface only when it actually contains the video', () => {
    expect(selectNativeCaptureSurfaceScope({
      fullscreenContainsVideo: true,
      hasLocalFullscreenElement: true,
    })).toBe('fullscreen');
    expect(selectNativeCaptureSurfaceScope({
      fullscreenContainsVideo: false,
      hasLocalFullscreenElement: true,
    })).toBe('player');
    expect(selectNativeCaptureSurfaceScope({
      fullscreenContainsVideo: false,
      hasLocalFullscreenElement: false,
    })).toBe('player');
  });

  it('walks ancestors from the root up to the fullscreen element', () => {
    const body = {} as HTMLElement;
    const documentElement = {} as HTMLElement;
    vi.stubGlobal('document', { body, documentElement });
    const fullscreen = { parentElement: body } as unknown as Element;
    const player = { parentElement: fullscreen } as unknown as HTMLElement;
    const root = { parentElement: player } as unknown as HTMLElement;

    expect(playerAncestorPath(root, fullscreen)).toEqual([root, player, fullscreen]);
  });

  it('stops the ancestor walk at the body when there is no fullscreen element', () => {
    const body = {} as HTMLElement;
    const documentElement = {} as HTMLElement;
    vi.stubGlobal('document', { body, documentElement });
    const child = { parentElement: body } as unknown as HTMLElement;

    expect(playerAncestorPath(child, null)).toEqual([child, body]);
  });
});

