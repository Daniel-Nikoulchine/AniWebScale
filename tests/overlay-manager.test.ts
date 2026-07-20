import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlayManager } from '../src/core/overlay-manager';

function bareOverlay(): any {
  const overlay = Object.create(OverlayManager.prototype) as any;
  overlay.canvas = undefined;
  overlay.canvasVisible = false;
  overlay.originalOpacity = '';
  overlay.originalOpacityPriority = '';
  overlay.appliedOpacity = '';
  overlay.appliedOpacityPriority = '';
  overlay.opacityManaged = false;
  overlay.destroyed = false;
  overlay.positionUpdateFrame = null;
  overlay.setStats = vi.fn();
  overlay.setWarning = vi.fn();
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
    const style = opacityStyle('0', 'important');
    overlay.video = { style };
    overlay.originalOpacity = '0.65';
    overlay.originalOpacityPriority = 'important';
    overlay.appliedOpacity = '0';
    overlay.appliedOpacityPriority = 'important';
    overlay.opacityManaged = true;
    overlay.canvasVisible = true;
    overlay.canvas = { remove };

    overlay.hideCanvas();

    expect(overlay.video.style.opacity).toBe('0.65');
    expect(style.getPropertyPriority('opacity')).toBe('important');
    expect(remove).toHaveBeenCalledOnce();
    expect(overlay.canvasVisible).toBe(false);
  });

  it('preserves a site opacity change made while the canvas is visible', () => {
    const overlay = bareOverlay();
    const style = opacityStyle('0', 'important');
    overlay.video = { style };
    overlay.originalOpacity = '0.65';
    overlay.originalOpacityPriority = '';
    overlay.appliedOpacity = '0';
    overlay.appliedOpacityPriority = 'important';
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
});
