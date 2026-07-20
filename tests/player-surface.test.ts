import { describe, expect, it } from 'vitest';
import { isPlausiblePlayerSurface } from '../src/shared/player-surface';

describe('fullscreen player surface selection', () => {
  it('accepts a compact player with controls but rejects a whole page', () => {
    const video = { width: 2048, height: 875 };
    expect(isPlausiblePlayerSurface(video, { width: 2048, height: 950 })).toBe(true);
    expect(isPlausiblePlayerSurface(video, { width: 2048, height: 1152 })).toBe(false);
  });
});
