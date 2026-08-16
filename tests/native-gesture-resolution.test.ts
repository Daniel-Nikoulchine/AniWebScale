import { describe, expect, it } from 'vitest';
import { resolveNativePointerGesture } from '../src/shared/native-gesture-resolution';
import { NATIVE_SEEK_ZONE_START } from '../src/shared/native-pointer-controls';

const base = {
  event: 'down' as const,
  button: 0,
  buttons: 1,
  normalizedX: 0.25,
  normalizedY: NATIVE_SEEK_ZONE_START,
  deltaY: 0,
  duration: 120,
  currentTime: 10,
  volume: 0.5,
  descriptor: 'VIDEO',
  targetIsVideo: true,
  targetRatioX: 0.25,
  interactiveTarget: false,
  hasIsolation: true,
  scrubbing: false,
};

describe('native pointer gesture resolution', () => {
  it('lets the seek surface own a press in the bottom strip', () => {
    expect(resolveNativePointerGesture(base)).toEqual({
      kind: 'seek',
      seekTime: 30,
      scrubbing: true,
    });
  });

  it('keeps an active scrub owned by the seek surface even over interactive controls', () => {
    expect(resolveNativePointerGesture({
      ...base,
      event: 'move',
      normalizedX: 0.75,
      normalizedY: 0.2,
      scrubbing: true,
      interactiveTarget: true,
      descriptor: 'BUTTON play-button',
    })).toEqual({ kind: 'seek', seekTime: 90, scrubbing: true });
  });

  it('releases the scrub on pointer up', () => {
    expect(resolveNativePointerGesture({
      ...base,
      event: 'up',
      buttons: 0,
      normalizedX: 0.5,
      normalizedY: 0.2,
      scrubbing: true,
    })).toEqual({ kind: 'seek', seekTime: 60, scrubbing: false });
  });

  it('routes presses on interactive controls to the page, not the seek surface', () => {
    const resolution = resolveNativePointerGesture({
      ...base,
      normalizedY: 0.5,
      interactiveTarget: true,
      descriptor: 'BUTTON play-button',
    });
    expect(resolution.kind).toBe('synthesize');
    expect(resolution.scrubbing).toBe(false);
  });

  it('falls back to a media command for a video click', () => {
    const resolution = resolveNativePointerGesture({
      ...base,
      event: 'up',
      buttons: 0,
      normalizedY: 0.5,
      descriptor: 'VIDEO',
    });
    expect(resolution).toEqual({
      kind: 'synthesize',
      fallback: { command: 'playPause' },
      scrubbing: false,
    });
  });

  it('suppresses fullscreen-control presses while isolated', () => {
    // A press (down) on a fullscreen control resolves to no media command, so
    // the isolated page swallows it instead of dispatching it.
    expect(resolveNativePointerGesture({
      ...base,
      normalizedY: 0.1,
      interactiveTarget: true,
      descriptor: 'BUTTON enter-fullscreen',
    })).toEqual({
      kind: 'suppress-fullscreen-control',
      notify: false,
      scrubbing: false,
    });
  });

  it('notifies when a non-primary release hits a fullscreen control while isolated', () => {
    expect(resolveNativePointerGesture({
      ...base,
      event: 'up',
      button: 2,
      buttons: 0,
      normalizedY: 0.1,
      interactiveTarget: true,
      descriptor: 'BUTTON enter-fullscreen',
    })).toEqual({
      kind: 'suppress-fullscreen-control',
      notify: true,
      scrubbing: false,
    });
  });

  it('does not suppress a fullscreen toggle that already resolved to a media command', () => {
    const resolution = resolveNativePointerGesture({
      ...base,
      event: 'up',
      buttons: 0,
      normalizedY: 0.1,
      interactiveTarget: true,
      descriptor: 'BUTTON exit-fullscreen',
    });
    // exit-fullscreen maps to a direct media command, so it is synthesized,
    // not suppressed.
    expect(resolution.kind).toBe('synthesize');
  });

  it('does not suppress fullscreen toggles without an isolation', () => {
    const resolution = resolveNativePointerGesture({
      ...base,
      event: 'up',
      buttons: 0,
      normalizedY: 0.1,
      interactiveTarget: true,
      descriptor: 'BUTTON enter-fullscreen',
      hasIsolation: false,
    });
    expect(resolution.kind).toBe('synthesize');
  });

  it('maps wheel events to volume commands', () => {
    const resolution = resolveNativePointerGesture({
      ...base,
      event: 'wheel',
      deltaY: -120,
      normalizedY: 0.5,
    });
    expect(resolution.kind).toBe('synthesize');
    if (resolution.kind === 'synthesize') {
      expect(resolution.fallback?.command).toBe('volumeBy');
    }
  });

  it('leaves live streams to the page controls', () => {
    const resolution = resolveNativePointerGesture({
      ...base,
      duration: Number.POSITIVE_INFINITY,
    });
    expect(resolution.kind).toBe('synthesize');
  });
});
