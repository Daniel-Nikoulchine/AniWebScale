import { clampNativePointerCoords } from '../native/protocol';
import { resolveNativePointerGesture } from '../shared/native-gesture-resolution';
import type { DirectMediaCommand } from '../shared/pointer-fallback';
import type { NativeIsolationSession } from './native-isolation';

/** The pointer payload forwarded from the native output window. */
export interface NativePointerInput {
  event: string;
  x: number;
  y: number;
  button?: number;
  buttons?: number;
  deltaX?: number;
  deltaY?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * Forwards pointer and media gestures from the native output window to the
 * page. Owns the DOM hit-test, the gesture resolution order, the synthetic
 * event dispatch and the delayed verification that falls back to a direct
 * media command when the page ignored the synthesized gesture.
 */
export class NativeInputBridge {
  private nativeSeekScrubbing = false;

  constructor(private readonly isolation: NativeIsolationSession) {
    this.isolation.onRestore(() => {
      this.nativeSeekScrubbing = false;
    });
  }

  /** Resolve one forwarded pointer event and act on it. */
  dispatchPointer(message: NativePointerInput): void {
    const video = this.isolation.activeVideo ?? this.isolation.selectVideo();
    if (!video) return;
    const root = this.isolation.activeRoot ?? this.isolation.activeVideo ?? video;
    const rect = root.getBoundingClientRect();
    const { x: normalizedX, y: normalizedY } = clampNativePointerCoords(
      Number(message.x),
      Number(message.y),
    );
    const clientX = rect.left + normalizedX * rect.width;
    const clientY = rect.top + normalizedY * rect.height;
    let target: Element | null = document.elementFromPoint(clientX, clientY);
    while (target?.shadowRoot) {
      const nested = target.shadowRoot.elementFromPoint(clientX, clientY);
      if (!nested || nested === target) break;
      target = nested;
    }
    target ??= video;

    const semanticTarget = target.closest('button, input, [role="button"], [role="slider"]') ?? target;
    const descriptor = [
      semanticTarget.tagName,
      semanticTarget.id,
      semanticTarget.className,
      semanticTarget.getAttribute('type'),
      semanticTarget.getAttribute('role'),
      semanticTarget.getAttribute('aria-label'),
      semanticTarget.getAttribute('title'),
      semanticTarget.getAttribute('data-testid'),
    ].filter(value => typeof value === 'string').join(' ');
    const targetRect = semanticTarget.getBoundingClientRect();
    const targetRatioX = targetRect.width > 0 ? (clientX - targetRect.left) / targetRect.width : normalizedX;
    const interactiveTarget = semanticTarget.matches('button, input, [role="button"], [role="slider"]');

    const resolution = resolveNativePointerGesture({
      event: message.event as 'move' | 'down' | 'up' | 'wheel',
      button: message.button ?? 0,
      buttons: message.buttons ?? 0,
      normalizedX,
      normalizedY,
      deltaY: message.deltaY ?? 0,
      duration: video.duration,
      currentTime: video.currentTime,
      volume: video.volume,
      descriptor,
      targetIsVideo: semanticTarget === video,
      targetRatioX,
      interactiveTarget,
      hasIsolation: this.isolation.active !== null,
      scrubbing: this.nativeSeekScrubbing,
    });
    this.nativeSeekScrubbing = resolution.scrubbing;

    if (resolution.kind === 'seek') {
      if (resolution.seekTime !== undefined
          && Math.abs(video.currentTime - resolution.seekTime) > 0.01) {
        video.currentTime = resolution.seekTime;
      }
      return;
    }

    if (resolution.kind === 'suppress-fullscreen-control') {
      if (resolution.notify) {
        showNotice('Native output is already fullscreen. Press Esc to exit.');
      }
      return;
    }

    const before = {
      paused: video.paused,
      currentTime: video.currentTime,
      volume: video.volume,
      muted: video.muted,
      fullscreen: document.fullscreenElement,
    };

    const scheduleDirectFallback = () => {
      const fallback = resolution.fallback;
      if (!fallback) return;
      window.setTimeout(() => {
        const expectedSeekTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER,
          Math.max(0, before.currentTime + (fallback.value ?? 0)));
        const expectedVolume = Math.min(1, Math.max(0, before.volume + (fallback.value ?? 0)));
        const needsFallback = fallback.command === 'playPause' ? video.paused === before.paused
          : fallback.command === 'seekBy' ? Math.abs(video.currentTime - expectedSeekTime) > 0.5
            : fallback.command === 'volumeBy' ? Math.abs(video.volume - expectedVolume) > 0.01
              : fallback.command === 'toggleMute' ? video.muted === before.muted
                : document.fullscreenElement === before.fullscreen;
        const command = fallback.command === 'toggleFullscreen' && document.fullscreenElement
          ? 'exitFullscreen'
          : fallback.command;
        if (needsFallback) void this.runMediaCommand(command as DirectMediaCommand, fallback.value).catch(() => undefined);
      }, 200);
    };

    if (message.event === 'wheel') {
      target.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        deltaX: message.deltaX ?? 0,
        deltaY: message.deltaY ?? 0,
        shiftKey: message.shiftKey === true,
        ctrlKey: message.ctrlKey === true,
        altKey: message.altKey === true,
      }));
      scheduleDirectFallback();
      return;
    }

    const eventType = message.event === 'down' ? 'pointerdown'
      : message.event === 'up' ? 'pointerup'
        : 'pointermove';
    target.dispatchEvent(new PointerEvent(eventType, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX,
      clientY,
      button: message.button ?? 0,
      buttons: message.buttons ?? 0,
      shiftKey: message.shiftKey === true,
      ctrlKey: message.ctrlKey === true,
      altKey: message.altKey === true,
    }));
    const mouseEventType = message.event === 'down' ? 'mousedown'
      : message.event === 'up' ? 'mouseup'
        : 'mousemove';
    target.dispatchEvent(new MouseEvent(mouseEventType, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      // MouseEvent.button must be >= 0 per the DOM spec; -1 is only valid for
      // PointerEvent. The native protocol sends -1 for "no button changed" on
      // move events, so clamp it to 0 here and default to 0 when absent.
      button: message.button !== undefined ? Math.max(0, message.button) : 0,
      buttons: message.buttons ?? 0,
      shiftKey: message.shiftKey === true,
      ctrlKey: message.ctrlKey === true,
      altKey: message.altKey === true,
    }));
    // Players typically reveal their control bar on pointerover / mouseover,
    // not on every move. Dispatch the corresponding over-events so synthetic
    // pointer traffic from the native output window still triggers the UI.
    if (message.event === 'move') {
      target.dispatchEvent(new PointerEvent('pointerover', {
        bubbles: true, cancelable: true, composed: true,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX, clientY, button: 0, buttons: 0,
      }));
      target.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true, cancelable: true, composed: true,
        clientX, clientY, button: 0, buttons: 0,
      }));
    }
    if (message.event === 'up' && message.button === 0) {
      target.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX,
        clientY,
        button: 0,
        shiftKey: message.shiftKey === true,
        ctrlKey: message.ctrlKey === true,
        altKey: message.altKey === true,
      }));
    }
    scheduleDirectFallback();
  }

  /** Execute a direct media command against the captured video. */
  async runMediaCommand(command: string, value?: number): Promise<{ fullscreenActive: boolean }> {
    if (command === 'exitFullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen();
      return { fullscreenActive: Boolean(document.fullscreenElement) };
    }
    const video = this.isolation.activeVideo ?? this.isolation.selectVideo();
    if (!video) return { fullscreenActive: Boolean(document.fullscreenElement) };
    switch (command) {
      case 'playPause':
        if (video.paused) await video.play(); else video.pause();
        break;
      case 'play':
        await video.play();
        break;
      case 'pause':
        video.pause();
        break;
      case 'seekBy':
        video.currentTime = Math.min(video.duration || Number.MAX_SAFE_INTEGER,
          Math.max(0, video.currentTime + (Number.isFinite(value) ? value! : 0)));
        break;
      case 'volumeBy':
        video.volume = Math.min(1, Math.max(0, video.volume + (Number.isFinite(value) ? value! : 0)));
        break;
      case 'toggleMute':
        video.muted = !video.muted;
        break;
      case 'toggleFullscreen':
        if (this.isolation.active) break;
        if (document.fullscreenElement) await document.exitFullscreen();
        break;
    }
    return { fullscreenActive: Boolean(document.fullscreenElement) };
  }
}

/** A transient in-page notice for native session feedback. */
export function showNotice(message: string, isError = false): void {
  const previous = document.getElementById('anime4k-native-notice');
  previous?.remove();
  const notice = document.createElement('div');
  notice.id = 'anime4k-native-notice';
  notice.textContent = message;
  Object.assign(notice.style, {
    position: 'fixed',
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    padding: '10px 16px',
    borderRadius: '8px',
    background: isError ? '#9b1c1c' : 'rgba(20, 20, 24, .94)',
    color: '#fff',
    font: '13px/1.4 system-ui, sans-serif',
    boxShadow: '0 4px 18px rgba(0,0,0,.35)',
    visibility: 'visible',
  });
  document.documentElement.appendChild(notice);
  setTimeout(() => notice.remove(), isError ? 8_000 : 3_000);
}
