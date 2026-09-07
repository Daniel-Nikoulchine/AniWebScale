import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlayManager } from '../src/core/overlay-manager';
import { applyTemporaryProperty } from '../src/shared/temporary-restyle';

function bareOverlay(): any {
  const overlay = Object.create(OverlayManager.prototype) as any;
  overlay.canvas = undefined;
  overlay.canvasVisible = false;
  overlay.opacitySnapshot = new Map();
  overlay.opacityManaged = false;
  overlay.destroyed = false;
  overlay.positionUpdateFrame = null;
  overlay.setStats = vi.fn();
  overlay.setWarning = vi.fn();
  overlay.attachGlobalListeners = vi.fn();
  overlay.detachGlobalListeners = vi.fn();
  return overlay;
}

function opacityStyle(value: string, priority = ''): CSSStyleDeclaration {
  let currentValue = value;
  let currentPriority = priority;
  return {
    get opacity() { return currentValue; },
    set opacity(next: string) { currentValue = next; currentPriority = ''; },
    getPropertyValue: vi.fn((name: string) => name === 'opacity' ? currentValue : ''),
    getPropertyPriority: vi.fn((name: string) => name === 'opacity' ? currentPriority : ''),
    setProperty: vi.fn((name: string, next: string, nextPriority = '') => {
      if (name === 'opacity') { currentValue = next; currentPriority = nextPriority; }
    }),
    removeProperty: vi.fn((name: string) => {
      const previous = currentValue;
      if (name === 'opacity') { currentValue = ''; currentPriority = ''; }
      return previous;
    }),
  } as unknown as CSSStyleDeclaration;
}

describe('overlay lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not overwrite site opacity when the canvas was never shown', () => {
    const overlay = bareOverlay();
    overlay.video = { style: { opacity: '0.65' } };

    overlay.hideCanvas();

    expect(overlay.video.style.opacity).toBe('0.65');
  });

  it('restores the exact site opacity after hiding a visible canvas', () => {
    const overlay = bareOverlay();
    const remove = vi.fn();
    const style = opacityStyle('0.65');
    overlay.video = { style };
    overlay.opacitySnapshot = applyTemporaryProperty(overlay.video, 'opacity', '0');
    overlay.opacityManaged = true;
    overlay.canvasVisible = true;
    overlay.canvas = { remove };

    overlay.hideCanvas();

    expect(overlay.video.style.opacity).toBe('0.65');
    expect(style.getPropertyPriority('opacity')).toBe('');
    expect(remove).toHaveBeenCalledOnce();
    expect(overlay.canvasVisible).toBe(false);
  });

  it('preserves a site opacity change made while the canvas is visible', () => {
    const overlay = bareOverlay();
    const style = opacityStyle('0.65');
    overlay.video = { style };
    overlay.opacitySnapshot = applyTemporaryProperty(overlay.video, 'opacity', '0');
    overlay.opacityManaged = true;
    overlay.canvasVisible = true;
    style.setProperty('opacity', '0.8');

    overlay.hideCanvas();

    expect(style.opacity).toBe('0.8');
  });

  it('conceals an attached canvas while a replacement video is being retargeted', () => {
    const overlay = bareOverlay();
    const oldParent = {};
    const insertBefore = vi.fn();
    overlay.video = { style: opacityStyle('0', 'important') };
    overlay.host = { getAttribute: vi.fn(() => 'video-1') };
    overlay.canvas = {
      parentNode: oldParent,
      style: { visibility: 'visible' },
    };
    overlay.canvasVisible = true;
    overlay.restoreVideoOpacity = vi.fn();
    overlay.unobserveVideo = vi.fn();
    overlay.observeVideo = vi.fn();
    overlay.updatePosition = vi.fn();
    const replacement = {
      dataset: {},
      parentNode: { insertBefore },
    };
    vi.stubGlobal('document', { body: { appendChild: vi.fn() } });

    overlay.reattach(replacement);

    expect(overlay.restoreVideoOpacity).toHaveBeenCalledOnce();
    expect(insertBefore).toHaveBeenCalledWith(overlay.canvas, replacement);
    expect(overlay.canvas.style.visibility).toBe('hidden');
    expect(overlay.canvasVisible).toBe(false);
  });

  it('coalesces repeated layout notifications into one animation frame', () => {
    const overlay = bareOverlay();
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal('window', { requestAnimationFrame, cancelAnimationFrame: vi.fn() });
    overlay.updatePosition = vi.fn();

    overlay.schedulePositionUpdate();
    overlay.schedulePositionUpdate();

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    callbacks[0](16);
    expect(overlay.updatePosition).toHaveBeenCalledOnce();
    expect(overlay.positionUpdateFrame).toBeNull();
  });

  it('clears stale stats on detach so a reattached video starts blank', () => {
    const overlay = bareOverlay();
    overlay.resizeObserver = { disconnect: vi.fn() };
    overlay.mutationObserver = { disconnect: vi.fn() };
    overlay.videoEvents = { dispose: vi.fn() };
    overlay.host = { style: {}, remove: vi.fn() };

    overlay.detach();

    expect(overlay.setStats).toHaveBeenCalledWith(null);
  });

  it('drops the old video observations before watching the replacement', () => {
    const overlay = bareOverlay();
    overlay.video = { style: opacityStyle('1') };
    overlay.host = { getAttribute: vi.fn(() => 'video-1') };
    overlay.canvasVisible = false;
    overlay.unobserveVideo = vi.fn();
    overlay.observeVideo = vi.fn();
    overlay.updatePosition = vi.fn();
    const replacement = { dataset: {}, parentNode: null };
    vi.stubGlobal('document', { body: { appendChild: vi.fn() } });

    overlay.reattach(replacement);

    expect(overlay.unobserveVideo).toHaveBeenCalledOnce();
    expect(overlay.observeVideo).toHaveBeenCalledOnce();
    expect(overlay.video).toBe(replacement);
  });

  it('re-homes a visible canvas that detach() removed from the DOM', () => {
    const overlay = bareOverlay();
    overlay.video = { style: opacityStyle('1') };
    overlay.host = { getAttribute: vi.fn(() => 'video-1') };
    // detach() calls canvas.remove() but keeps the reference and the flag.
    overlay.canvas = { parentNode: null, style: { visibility: 'visible' } };
    overlay.canvasVisible = true;
    overlay.restoreVideoOpacity = vi.fn();
    overlay.unobserveVideo = vi.fn();
    overlay.observeVideo = vi.fn();
    overlay.updatePosition = vi.fn();
    const insertBefore = vi.fn();
    const replacement = { dataset: {}, parentNode: { insertBefore } };
    vi.stubGlobal('document', { body: { appendChild: vi.fn() } });

    overlay.reattach(replacement);

    expect(insertBefore).toHaveBeenCalledWith(overlay.canvas, replacement);
  });

  it('ignores reattach after destroy instead of resurrecting the manager', () => {
    const overlay = bareOverlay();
    overlay.destroyed = true;
    overlay.unobserveVideo = vi.fn();
    overlay.observeVideo = vi.fn();
    const replacement = { dataset: {} };

    overlay.reattach(replacement);

    expect(overlay.unobserveVideo).not.toHaveBeenCalled();
    expect(overlay.observeVideo).not.toHaveBeenCalled();
  });
});

describe('runnerLabelForStats', () => {
  it('tells native-gpu apart from the ORT worker', async () => {
    const { runnerLabelForStats } = await import('../src/core/overlay-manager');
    // Native serves through the worker slot (runnerPct includes native),
    // so nativePct decides first.
    expect(runnerLabelForStats({ nativePct: 100, runnerPct: 100 })).toBe('native-gpu');
    expect(runnerLabelForStats({ nativePct: 60, runnerPct: 100 })).toBe('native-gpu');
    expect(runnerLabelForStats({ nativePct: 49, runnerPct: 100 })).toBe('runner');
    expect(runnerLabelForStats({ nativePct: 0, runnerPct: 100 })).toBe('runner');
    expect(runnerLabelForStats({ nativePct: 0, runnerPct: 0 })).toBe('main');
  });
});
