import type { RenderStats } from '../types';
import { fullscreenContainsVideo } from '../shared/fullscreen-video';
import { fullscreenContext } from './fullscreen-context';
import { choosePlayerSurface } from '../shared/player-surface';
import { EventScope } from '../shared/event-scope';
import {
  applyTemporaryProperty,
  restoreTemporaryStyles,
  type TemporaryInlineStyles,
} from '../shared/temporary-restyle';

const MIN_VIDEO_WIDTH = 240;
const MIN_VIDEO_HEIGHT = 135;

/**
 * Runner label for the RealESRGAN overlay line. The native Vulkan host also
 * serves through the runner slot, so runnerPct alone cannot tell it apart
 * from the ORT worker — nativePct (a subset of runnerPct) decides first.
 * Pure for tests; thresholds mirror the compose-path majority rule below.
 */
export function runnerLabelForStats(stats: { nativePct: number; runnerPct: number }): string {
  if (stats.nativePct >= 50) return 'native-gpu';
  return stats.runnerPct >= 50 ? 'runner' : 'main';
}

export class OverlayManager {
  private video: HTMLVideoElement;
  private readonly host: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private readonly statsPanel: HTMLDivElement;
  private canvas?: HTMLCanvasElement;
  private canvasVisible = false;
  private opacitySnapshot: TemporaryInlineStyles = new Map();
  private opacityManaged = false;
  private destroyed = false;
  private positionUpdateFrame: number | null = null;

  private readonly resizeObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private readonly updateBound = () => this.schedulePositionUpdate();
  private readonly fullscreenBound = () => this.handleFullscreenChange();
  private unsubscribeFullscreen!: () => void;
  private globalListenersAttached = false;
  private readonly videoEvents = new EventScope();
  private reconnectTimer: number | null = null;

  private static readonly HOST_MARKER = 'data-anime4k-overlay-host';
  /** Live managers by video id: recreating for one video destroys the old
   * manager instead of orphaning its observers and global listeners. */
  private static readonly live = new Map<string, OverlayManager>();

  public static create(video: HTMLVideoElement): OverlayManager {
    const videoId = video.dataset.anime4kVideoId;
    if (videoId) {
      OverlayManager.live.get(videoId)?.destroy();
      document.querySelectorAll<HTMLElement>(`[${OverlayManager.HOST_MARKER}="${CSS.escape(videoId)}"]`)
        .forEach(host => host.remove());
    }
    const manager = new OverlayManager(video);
    if (videoId) OverlayManager.live.set(videoId, manager);
    return manager;
  }

  private constructor(video: HTMLVideoElement) {
    this.video = video;
    this.host = document.createElement('div');
    this.host.setAttribute(OverlayManager.HOST_MARKER, video.dataset.anime4kVideoId ?? '');
    Object.assign(this.host.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '2147483646',
      display: 'none',
    });
    // Mirror reattach/fullscreenchange placement: a manager created while its
    // video is already fullscreen must not park the host in <body>, where the
    // fullscreen layout's visibility rules would hide the stats panel.
    if (document.body) {
      const initialFullscreen = fullscreenContext.element;
      if (fullscreenContainsVideo(initialFullscreen, video) && initialFullscreen) {
        choosePlayerSurface(video, initialFullscreen).appendChild(this.host);
      } else {
        document.body.appendChild(this.host);
      }
    }

    this.shadowRoot = this.host.attachShadow({ mode: 'closed' });
    this.injectStyles();

    this.statsPanel = document.createElement('div');
    this.statsPanel.className = 'stats';
    this.statsPanel.hidden = true;
    this.shadowRoot.appendChild(this.statsPanel);

    this.resizeObserver = new ResizeObserver(this.updateBound);
    this.mutationObserver = new MutationObserver(this.updateBound);
    this.attachGlobalListeners();
    this.observeVideo();
    this.updatePosition();
  }

  private observeVideo(): void {
    this.resizeObserver.observe(this.video);
    this.mutationObserver.observe(this.video, {
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
    this.videoEvents.on(this.video, 'play', this.updateBound, { passive: true });
    this.videoEvents.on(this.video, 'loadedmetadata', this.updateBound, { passive: true });
  }

  private unobserveVideo(): void {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    this.videoEvents.dispose();
    this.cancelPositionUpdate();
    this.clearReconnectTimer();
  }

  /** window is unavailable in DOM-less unit tests; never crash teardown. */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
      window.clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = null;
  }

  private attachGlobalListeners(): void {
    if (this.globalListenersAttached) return;
    this.globalListenersAttached = true;
    this.unsubscribeFullscreen = fullscreenContext.subscribe(this.fullscreenBound);
    window.addEventListener('resize', this.updateBound);
    window.addEventListener('scroll', this.updateBound, { capture: true, passive: true });
  }

  private detachGlobalListeners(): void {
    if (!this.globalListenersAttached) return;
    this.globalListenersAttached = false;
    window.removeEventListener('resize', this.updateBound);
    window.removeEventListener('scroll', this.updateBound, true);
    this.unsubscribeFullscreen();
  }

  private schedulePositionUpdate(): void {
    if (this.destroyed || this.positionUpdateFrame !== null) return;
    this.positionUpdateFrame = window.requestAnimationFrame(() => {
      this.positionUpdateFrame = null;
      this.updatePosition();
    });
  }

  private cancelPositionUpdate(): void {
    if (this.positionUpdateFrame === null) return;
    window.cancelAnimationFrame(this.positionUpdateFrame);
    this.positionUpdateFrame = null;
  }

  private updatePosition(): void {
    if (this.destroyed || !this.video.isConnected) {
      this.host.style.display = 'none';
      // A temporarily removed video (player re-parenting) fires no observer
      // the manager watches; re-check shortly after re-insertion instead of
      // staying hidden until the next random layout event. The retry chain
      // ends with the manager (destroy clears the timer; unobserve on
      // detach/reattach resets it). Skipped where no window exists (tests).
      if (!this.destroyed && this.reconnectTimer === null && typeof window !== 'undefined'
        && typeof window.setTimeout === 'function') {
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.updatePosition();
        }, 1000);
      }
      return;
    }
    if (this.reconnectTimer !== null) {
      this.clearReconnectTimer();
    }

    const rect = this.video.getBoundingClientRect();
    const computed = getComputedStyle(this.video);
    const visible = rect.width >= MIN_VIDEO_WIDTH
      && rect.height >= MIN_VIDEO_HEIGHT
      && rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth
      && computed.display !== 'none'
      && computed.visibility !== 'hidden'
      && (this.canvasVisible || Number.parseFloat(computed.opacity || '1') > 0);
    this.host.style.display = visible ? 'block' : 'none';
    if (!visible) return;

    const parent = this.host.parentElement;
    // The absolutely-positioned host aligns to its offsetParent (nearest
    // positioned ancestor), which need not be its DOM parent when the player
    // nests it inside static wrappers. Measure against the offsetParent so
    // coordinates land correctly in both cases.
    const offsetParent = this.host.offsetParent;
    const relativeTo = offsetParent instanceof HTMLElement && offsetParent !== this.host
      ? offsetParent
      : parent && parent !== document.body ? parent : null;
    const parentRect = relativeTo
      ? relativeTo.getBoundingClientRect()
      : { top: -window.scrollY, left: -window.scrollX };
    Object.assign(this.host.style, {
      top: `${rect.top - parentRect.top}px`,
      left: `${rect.left - parentRect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    if (this.canvas) {
      Object.assign(this.canvas.style, {
        position: 'absolute',
        top: `${this.video.offsetTop}px`,
        left: `${this.video.offsetLeft}px`,
        width: `${this.video.offsetWidth}px`,
        height: `${this.video.offsetHeight}px`,
        transform: computed.transform,
        transformOrigin: computed.transformOrigin,
        objectFit: computed.objectFit,
        objectPosition: computed.objectPosition,
        zIndex: computed.zIndex,
        pointerEvents: 'none',
      });
    }
  }

  private handleFullscreenChange(): void {
    const fullscreen = fullscreenContext.element;
    if (fullscreenContainsVideo(fullscreen, this.video)) {
      choosePlayerSurface(this.video, fullscreen).appendChild(this.host);
    }
    else if (this.host.parentElement !== document.body && document.body) document.body.appendChild(this.host);
    this.updatePosition();
  }

  public getCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.visibility = 'hidden';
    }
    return this.canvas;
  }

  /** True once a rendered frame was presented on the output canvas. */
  public get isCanvasVisible(): boolean {
    return this.canvasVisible;
  }

  public showCanvas(): void {
    const canvas = this.getCanvas();
    if (canvas.parentNode !== this.video.parentNode) {
      this.video.parentNode?.insertBefore(canvas, this.video);
    }
    if (!this.canvasVisible) this.hideVideoForCanvas();
    canvas.style.visibility = 'visible';
    this.canvasVisible = true;
    this.updatePosition();
  }

  public hideCanvas(): void {
    if (this.canvasVisible) this.restoreVideoOpacity();
    this.canvas?.remove();
    this.canvas = undefined;
    this.canvasVisible = false;
    this.setStats(null);
  }

  public setStats(stats: RenderStats | null): void {
    if (!stats) {
      this.statsPanel.hidden = true;
      this.statsPanel.textContent = '';
      return;
    }
    if (stats.realesrgan) {
      const r = stats.realesrgan;
      const composePath = r.gpuComposePct >= 50 ? 'gpu' : 'cpu';
      const worker = runnerLabelForStats(r);
      const precision = r.precision === 'fp16' ? 'FP16' : r.precision === 'int8' ? 'INT8' : 'FP32';
      const head = typeof r.enhancedFps === 'number' && typeof r.count === 'number'
        ? `${stats.fps.toFixed(1)} present / ${r.enhancedFps.toFixed(1)} enhance FPS  ${stats.renderMs.toFixed(1)} ms  ${stats.droppedFrames} dropped (${r.count} enhanced)`
        : `${stats.fps.toFixed(1)} FPS  ${stats.renderMs.toFixed(1)} ms  ${stats.droppedFrames} dropped`;
      this.statsPanel.replaceChildren();
      const line1 = document.createElement('div');
      line1.textContent = head;
      const line2 = document.createElement('div');
      line2.textContent =
        `readback ${r.readbackMs.toFixed(1)}ms  infer ${r.inferMs.toFixed(1)}ms  ` +
        `compose ${r.composeMs.toFixed(1)}ms (${composePath}, ${worker}, ${precision})`;
      line2.style.marginTop = '3px';
      line2.style.opacity = '0.85';
      this.statsPanel.appendChild(line1);
      this.statsPanel.appendChild(line2);
    } else {
      const head = `${stats.fps.toFixed(1)} FPS  ${stats.renderMs.toFixed(1)} ms  ${stats.droppedFrames} dropped`;
      this.statsPanel.textContent = head;
    }
    this.statsPanel.hidden = false;
    this.statsPanel.classList.toggle('overloaded', stats.warning);
  }

  public detach(): void {
    this.unobserveVideo();
    this.detachGlobalListeners();
    this.setStats(null);
    this.host.style.display = 'none';
    this.host.remove();
    this.canvas?.remove();
    if (this.canvasVisible) this.restoreVideoOpacity();
  }

  public reattach(newVideo: HTMLVideoElement): void {
    if (this.destroyed) return;
    // A re-homed overlay must not show the previous video's stats until the
    // new source renders its first frame (detach() already blanks them).
    this.setStats(null);
    const wasVisible = this.canvasVisible;
    // detach() removes the canvas from the DOM while keeping the reference;
    // a still-visible canvas must be re-homed to the new video, not stranded.
    const canvasNeedsHome = Boolean(this.canvas) && (wasVisible || Boolean(this.canvas?.parentNode));
    if (wasVisible) this.restoreVideoOpacity();
    // Drop the old video's observations before subscribing to the new one:
    // observers and the event scope accumulate targets otherwise.
    this.unobserveVideo();
    this.video = newVideo;
    this.video.dataset.anime4kVideoId = this.host.getAttribute(OverlayManager.HOST_MARKER) ?? '';
    // A mid-fullscreen reattach must not park the host in <body>, where the
    // fullscreen layout's visibility rules would hide the stats panel until
    // the next fullscreen toggle; mirror the fullscreenchange placement.
    const fullscreen = fullscreenContext.element;
    if (fullscreenContainsVideo(fullscreen, newVideo)) {
      choosePlayerSurface(newVideo, fullscreen).appendChild(this.host);
    } else if (document.body) {
      document.body.appendChild(this.host);
    }
    if (this.canvas && canvasNeedsHome) {
      newVideo.parentNode?.insertBefore(this.canvas, newVideo);
    }
    if (this.canvas && wasVisible) {
      // The renderer still contains the previous video's pixels until its
      // asynchronous source switch completes. Keep the new video visible in
      // the meantime; onFirstFrameRendered will reveal this canvas again.
      this.canvas.style.visibility = 'hidden';
      this.canvasVisible = false;
    }
    this.observeVideo();
    this.attachGlobalListeners();
    this.updatePosition();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearReconnectTimer();
    OverlayManager.live.delete(
      typeof this.host.getAttribute === 'function'
        ? this.host.getAttribute(OverlayManager.HOST_MARKER) ?? ''
        : '',
    );
    this.unobserveVideo();
    this.detachGlobalListeners();
    this.hideCanvas();
    this.host.remove();
  }

  private hideVideoForCanvas(): void {
    this.opacitySnapshot = applyTemporaryProperty(this.video, 'opacity', '0');
    this.opacityManaged = true;
  }

  private restoreVideoOpacity(): void {
    if (!this.opacityManaged) return;
    restoreTemporaryStyles(this.video, this.opacitySnapshot);
    this.opacityManaged = false;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { pointer-events: none; font-family: system-ui, sans-serif; }
      .stats {
        position: absolute;
        left: 12px;
        bottom: 12px;
        max-width: calc(100% - 24px);
        box-sizing: border-box;
        padding: 6px 9px;
        border-radius: 7px;
        background: rgba(8, 8, 10, .78);
        color: #fff;
        font: 500 11px/1.35 ui-monospace, monospace;
      }
      .stats.overloaded { color: #ffd17a; }
      [hidden] { display: none !important; }
    `;
    this.shadowRoot.appendChild(style);
  }
}
