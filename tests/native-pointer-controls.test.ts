import { describe, expect, it } from 'vitest';
import {
  NATIVE_SEEK_ZONE_START,
  selectNativeSurfacePointerAction,
} from '../src/shared/native-pointer-controls';

const base = {
  event: 'down' as const,
  button: 0,
  buttons: 1,
  normalizedX: 0.25,
  normalizedY: NATIVE_SEEK_ZONE_START,
  duration: 120,
  scrubbing: false,
};

describe('native output seek surface', () => {
  it('starts an absolute seek from a primary press in the bottom strip', () => {
    expect(selectNativeSurfacePointerAction(base)).toEqual({
      consume: true,
      scrubbing: true,
      seekTime: 30,
    });
  });

  it('continues scrubbing outside the strip until the pointer is released', () => {
    expect(selectNativeSurfacePointerAction({
      ...base,
      event: 'move',
      normalizedX: 0.75,
      normalizedY: 0.2,
      scrubbing: true,
    })).toEqual({ consume: true, scrubbing: true, seekTime: 90 });

    expect(selectNativeSurfacePointerAction({
      ...base,
      event: 'up',
      buttons: 0,
      normalizedX: 0.5,
      normalizedY: 0.2,
      scrubbing: true,
    })).toEqual({ consume: true, scrubbing: false, seekTime: 60 });
  });

  it('leaves ordinary video clicks and live streams to the existing controls', () => {
    expect(selectNativeSurfacePointerAction({ ...base, normalizedY: NATIVE_SEEK_ZONE_START - 0.01 }))
      .toEqual({ consume: false, scrubbing: false });
    expect(selectNativeSurfacePointerAction({ ...base, duration: Number.POSITIVE_INFINITY }))
      .toEqual({ consume: false, scrubbing: false });
  });

  it('cancels a lost drag when the primary button is no longer held', () => {
    expect(selectNativeSurfacePointerAction({
      ...base,
      event: 'move',
      buttons: 0,
      scrubbing: true,
    })).toEqual({ consume: false, scrubbing: false });
  });
});
