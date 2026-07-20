import type { RenderStats } from '../types';
import { fullscreenContainsVideo, getFullscreenElement } from '../shared/fullscreen-video';
import { choosePlayerSurface } from '../shared/player-surface';

const MIN_VIDEO_WIDTH = 240;
const MIN_VIDEO_HEIGHT = 135;

export class OverlayManager {
  private video: HTMLVideoElement;
  private readonly host: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private readonly statsPanel: HTMLDivElement;
  private readonly warningPanel: HTMLDivElement;
  private canvas?: HTMLCanvasElement;
  private canvasVisible = false;
  private originalOpacity = '';
  private originalOpacityPriority = '';
  private appliedOpacity = '';
  private appliedOpacityPriority = '';
  private opacityManaged = false;
  private destroyed = false;
  private positionUpdateFrame: number | null = null;

  private readonly resizeObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private readonly updateBound = () => this.schedulePositionUpdate();
  private readonly fullscreenBound = () => this.handleFullscreenChange();

  private static readonly HOST_MARKER = 'data-anime4k-overlay-host';

  public static create(video: HTMLVideoElement): OverlayManager {
    const videoId = video.dataset.anime4kVideoId;
    if (videoId) {
      document.querySelectorAll<HTMLElement>(`[${OverlayManager.HOST_MARKER}="${CSS.escape(videoId)}"]`)
        .forEach(host => host.remove());
    }
    return new OverlayManager(video);
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
    document.body.appendChild(this.host);

    this.shadowRoot = this.host.attachShadow({ mode: 'closed' });
    this.injectStyles();

    this.statsPanel = document.createElement('div');
    this.statsPanel.className = 'stats';
    this.statsPanel.hidden = true;
    this.shadowRoot.appendChild(this.statsPanel);

    this.warningPanel = document.createElement('div');
    this.warningPanel.className = 'warning';
    this.warningPanel.hidden = true;
    this.shadowRoot.appendChild(this.warningPanel);

    this.resizeObserver = new ResizeObserver(this.updateBound);
    this.mutationObserver = new MutationObserver(this.updateBound);
    this.observeVideo();
    window.addEventListener('resize', this.updateBound);
    window.addEventListener('scroll', this.updateBound, { capture: true, passive: true });
    document.addEventListener('fullscreenchange', this.fullscreenBound);
    this.updatePosition();
  }

  private observeVideo(): void {
    this.resizeObserver.observe(this.video);
    this.mutationObserver.observe(this.video, {
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
    this.video.addEventListener('play', this.updateBound, { passive: true });
    this.video.addEventListener('loadedmetadata', this.updateBound, { passive: true });
  }

  private unobserveVideo(): void {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    this.video.removeEventListener('play', this.updateBound);
    this.video.removeEventListener('loadedmetadata', this.updateBound);
    this.cancelPositionUpdate();
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
      return;
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
    const parentRect = parent && parent !== document.body
      ? parent.getBoundingClientRect()
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
    const fullscreen = getFullscreenElement();
    if (fullscreenContainsVideo(fullscreen, this.video)) {
      choosePlayerSurface(this.video, fullscreen).appendChild(this.host);
    }
    else if (this.host.parentElement !== document.body) document.body.appendChild(this.host);
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
    this.setWarning(null);
  }

  public setStats(stats: RenderStats | null): void {
    if (!stats) {
      this.statsPanel.hidden = true;
      return;
    }
    this.statsPanel.textContent = `${stats.fps.toFixed(1)} FPS  ${stats.renderMs.toFixed(1)} ms  ${stats.droppedFrames} dropped`;
    this.statsPanel.hidden = false;
    this.statsPanel.classList.toggle('overloaded', stats.warning);
  }

  public setWarning(message: string | null): void {
    this.warningPanel.textContent = message ?? '';
    this.warningPanel.hidden = !message;
  }

  public detach(): void {
    this.unobserveVideo();
    this.host.style.display = 'none';
    this.host.remove();
    this.canvas?.remove();
    if (this.canvasVisible) this.restoreVideoOpacity();
  }

  public reattach(newVideo: HTMLVideoElement): void {
    const wasVisible = this.canvasVisible;
    const canvasWasAttached = Boolean(this.canvas?.parentNode);
    if (wasVisible) this.restoreVideoOpacity();
    this.video = newVideo;
    this.video.dataset.anime4kVideoId = this.host.getAttribute(OverlayManager.HOST_MARKER) ?? '';
    document.body.appendChild(this.host);
    if (this.canvas && canvasWasAttached) {
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
    this.updatePosition();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unobserveVideo();
    window.removeEventListener('resize', this.updateBound);
    window.removeEventListener('scroll', this.updateBound, true);
    document.removeEventListener('fullscreenchange', this.fullscreenBound);
    this.hideCanvas();
    this.host.remove();
  }

  private hideVideoForCanvas(): void {
    this.originalOpacity = this.video.style.getPropertyValue('opacity');
    this.originalOpacityPriority = this.video.style.getPropertyPriority('opacity');
    this.video.style.setProperty('opacity', '0', 'important');
    this.appliedOpacity = this.video.style.getPropertyValue('opacity');
    this.appliedOpacityPriority = this.video.style.getPropertyPriority('opacity');
    this.opacityManaged = true;
  }

  private restoreVideoOpacity(): void {
    if (!this.opacityManaged) return;
    if (this.video.style.getPropertyValue('opacity') === this.appliedOpacity
        && this.video.style.getPropertyPriority('opacity') === this.appliedOpacityPriority) {
      if (!this.originalOpacity && !this.originalOpacityPriority) this.video.style.removeProperty('opacity');
      else this.video.style.setProperty('opacity', this.originalOpacity, this.originalOpacityPriority);
    }
    this.opacityManaged = false;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { pointer-events: none; font-family: system-ui, sans-serif; }
      .stats, .warning {
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
      .warning {
        bottom: 42px;
        background: rgba(111, 48, 0, .92);
        color: #fff2dc;
        font-family: system-ui, sans-serif;
      }
      [hidden] { display: none !important; }
    `;
    this.shadowRoot.appendChild(style);
  }
}
