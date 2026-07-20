import { describe, expect, it } from 'vitest';
import { selectPointerMediaFallback } from '../src/shared/pointer-fallback';

const base = {
  event: 'up' as const,
  button: 0,
  descriptor: '',
  targetIsVideo: false,
  targetRatioX: 0.75,
  deltaY: 0,
  duration: 100,
  currentTime: 20,
  volume: 0.4,
};

describe('direct native pointer media fallbacks', () => {
  it('maps common player controls to direct media commands', () => {
    expect(selectPointerMediaFallback({ ...base, targetIsVideo: true })).toEqual({ command: 'playPause' });
    expect(selectPointerMediaFallback({ ...base, descriptor: 'button fullscreen-control' }))
      .toEqual({ command: 'toggleFullscreen' });
    expect(selectPointerMediaFallback({ ...base, descriptor: 'button exit-fullscreen' }))
      .toEqual({ command: 'exitFullscreen' });
    expect(selectPointerMediaFallback({ ...base, descriptor: 'progress timeline slider' }))
      .toEqual({ command: 'seekBy', value: 55 });
    expect(selectPointerMediaFallback({ ...base, descriptor: 'volume range slider' }))
      .toEqual({ command: 'volumeBy', value: 0.35 });
    expect(selectPointerMediaFallback({ ...base, descriptor: 'button mute' }))
      .toEqual({ command: 'toggleMute' });
  });

  it('maps the DOM wheel sign to bounded volume changes', () => {
    expect(selectPointerMediaFallback({ ...base, event: 'wheel', deltaY: -120 }))
      .toEqual({ command: 'volumeBy', value: 0.05 });
    expect(selectPointerMediaFallback({ ...base, event: 'wheel', deltaY: 1200 }))
      .toEqual({ command: 'volumeBy', value: -0.2 });
  });

  it('does not add a direct command for unrelated pointer targets', () => {
    expect(selectPointerMediaFallback({ ...base, descriptor: 'button settings' })).toBeNull();
    expect(selectPointerMediaFallback({ ...base, event: 'move' })).toBeNull();
  });
});
