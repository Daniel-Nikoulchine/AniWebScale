import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeInputBridge } from '../src/core/native-input-bridge';

function createVideo() {
  return {
    paused: false,
    ended: false,
    duration: 120,
    currentTime: 0,
    volume: 0.5,
    muted: false,
    requestFullscreen: vi.fn(async () => undefined),
  } as unknown as HTMLVideoElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('native input direct media commands', () => {
  it('exits fullscreen when toggled while already in fullscreen', async () => {
    const video = createVideo();
    const isolation = {
      active: null,
      activeVideo: video,
      selectVideo: vi.fn(() => video),
      onRestore: vi.fn(),
    };
    const exitFullscreen = vi.fn(async () => undefined);
    vi.stubGlobal('document', { fullscreenElement: {}, exitFullscreen });

    const bridge = new NativeInputBridge(isolation as never);
    await bridge.runMediaCommand('toggleFullscreen');

    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(video.requestFullscreen).not.toHaveBeenCalled();
  });

  it('does not attempt to enter fullscreen without a user gesture', async () => {
    const video = createVideo();
    const isolation = {
      active: null,
      activeVideo: video,
      selectVideo: vi.fn(() => video),
      onRestore: vi.fn(),
    };
    // Runtime messages carry no user activation, so requestFullscreen would
    // be rejected by the browser with NotAllowedError. The toggle must not
    // pretend the enter direction works through this path.
    vi.stubGlobal('document', { fullscreenElement: null });

    const bridge = new NativeInputBridge(isolation as never);
    await bridge.runMediaCommand('toggleFullscreen');

    expect(video.requestFullscreen).not.toHaveBeenCalled();
  });
});
