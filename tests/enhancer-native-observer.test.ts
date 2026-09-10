import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NativeSessionObserver,
  type NativeSessionObserverContext,
} from '../src/core/enhancer-native-observer';
import { fullscreenContext } from '../src/core/fullscreen-context';
import type { NativeSessionClient } from '../src/core/native-session-client';

function createHarness() {
  const video = { paused: false, ended: false, currentTime: 1.5 } as unknown as HTMLVideoElement;
  const sendPlaybackState = vi.fn(async (_input: unknown) => undefined);
  const native = { sendPlaybackState } as unknown as NativeSessionClient;
  let nativeActive = true;
  let destroyed = false;
  let abandonedCurrent = false;
  let abandonedId: string | null = null;
  const recordStats = vi.fn();
  const markIdle = vi.fn();
  const blockAutoRetry = vi.fn();
  const scheduleFullscreenReconcile = vi.fn();
  const onSessionTerminated = vi.fn();
  const context: NativeSessionObserverContext = {
    isDestroyed: () => destroyed,
    isNativeActive: () => nativeActive,
    getVideo: () => video,
    getVideoId: () => 'video-1',
    isAbandonedSwitchCurrent: () => abandonedCurrent,
    abandonsSwitch: sessionId => abandonedId !== null && sessionId === abandonedId,
    recordStats,
    markIdle,
    blockAutoRetry,
    scheduleFullscreenReconcile,
    onSessionTerminated,
  };
  const observer = new NativeSessionObserver(context, native);
  return {
    observer,
    native,
    sendPlaybackState,
    recordStats,
    markIdle,
    blockAutoRetry,
    scheduleFullscreenReconcile,
    onSessionTerminated,
    setNativeActive: (next: boolean) => { nativeActive = next; },
    setDestroyed: (next: boolean) => { destroyed = next; },
    setAbandoned: (current: boolean, id: string | null) => {
      abandonedCurrent = current;
      abandonedId = id;
    },
    fire: (detail: Record<string, unknown>) => observer.handleEvent({ detail } as unknown as Event),
  };
}

describe('NativeSessionObserver', () => {
  let setIntervalSpy: ReturnType<typeof vi.fn>;
  let clearIntervalSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setIntervalSpy = vi.fn(() => 5);
    clearIntervalSpy = vi.fn();
    vi.stubGlobal('window', { setInterval: setIntervalSpy, clearInterval: clearIntervalSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tracks the session id and sends an immediate playback heartbeat', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');

    expect(harness.observer.currentSessionId).toBe('s1');
    expect(setIntervalSpy).toHaveBeenCalledOnce();
    expect(harness.sendPlaybackState).toHaveBeenCalledWith({
      sessionId: 's1',
      videoId: 'video-1',
      playbackActive: true,
      mediaTime: 1.5,
    });
  });

  it('stops the heartbeat and clears the session on reset', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');
    harness.observer.clearSession();
    expect(harness.observer.currentSessionId).toBeNull();
    expect(clearIntervalSpy).toHaveBeenCalledWith(5);
  });

  it('records a metrics sample as render stats while native-active', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');
    harness.fire({ type: 'metrics', sessionId: 's1', fps: 30, frameTimeMs: 10, droppedFrames: 2 });

    expect(harness.recordStats).toHaveBeenCalledWith({
      fps: 30,
      renderMs: 10,
      droppedFrames: 2,
      warning: false,
    });
  });

  it('ignores metrics while not native-active and events for other sessions', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');

    harness.setNativeActive(false);
    harness.fire({ type: 'metrics', sessionId: 's1', fps: 30, frameTimeMs: 10, droppedFrames: 0 });
    expect(harness.recordStats).not.toHaveBeenCalled();

    harness.setNativeActive(true);
    harness.fire({ type: 'metrics', sessionId: 'other', fps: 30, frameTimeMs: 10, droppedFrames: 0 });
    expect(harness.recordStats).not.toHaveBeenCalled();
  });

  it('swallows the abandoned switch session terminal event without teardown', () => {
    const harness = createHarness();
    harness.setAbandoned(true, 'session-old');
    harness.fire({ type: 'stopped', sessionId: 'session-old' });

    expect(harness.markIdle).toHaveBeenCalledOnce();
    expect(harness.observer.currentSessionId).toBeNull();
    expect(harness.onSessionTerminated).not.toHaveBeenCalled();
  });

  it('reports a terminal event and surfaces its message', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');
    harness.fire({ type: 'error', sessionId: 's1', state: 'failed', message: 'host exploded' });

    expect(harness.onSessionTerminated).toHaveBeenCalledWith({
      message: 'host exploded',
      retryCaptureAfterFailedExit: false,
    });
    expect(harness.scheduleFullscreenReconcile).not.toHaveBeenCalled();
  });

  it('retries a fullscreen reconcile after a capture-window close', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');
    const hasContext = vi.spyOn(fullscreenContext, 'hasContext').mockReturnValue(true);
    try {
      harness.fire({ type: 'stopped', sessionId: 's1', reason: 'capture_window_closed' });
    } finally {
      hasContext.mockRestore();
    }

    expect(harness.onSessionTerminated).toHaveBeenCalledWith({
      message: null,
      retryCaptureAfterFailedExit: true,
    });
    expect(harness.scheduleFullscreenReconcile).toHaveBeenCalledWith(250);
  });

  it('blocks auto-retry on a protected-capture terminal event', () => {
    const harness = createHarness();
    harness.observer.beginSession('s1');
    harness.fire({ type: 'error', sessionId: 's1', code: 'protected_capture_blocked' });

    expect(harness.blockAutoRetry).toHaveBeenCalledOnce();
  });
});
