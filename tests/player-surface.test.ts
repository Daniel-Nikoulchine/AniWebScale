import { describe, expect, it } from 'vitest';
import {
  isPlausiblePlayerSurface,
  selectNativeCaptureSurfaceScope,
} from '../src/shared/player-surface';

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
});
