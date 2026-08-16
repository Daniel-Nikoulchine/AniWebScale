import { fullscreenContainsVideo } from '../shared/fullscreen-video';
import {
  choosePlayerSurface,
  selectNativeCaptureSurfaceScope,
} from '../shared/player-surface';
import {
  calculateIntrinsicCaptureStage,
  type IntrinsicCaptureStage,
} from '../shared/intrinsic-capture';

export const VIDEO_ID_ATTRIBUTE = 'data-anime4k-video-id';
const NATIVE_ROOT_ATTRIBUTE = 'data-anime4k-native-root';
const NATIVE_VIDEO_ATTRIBUTE = 'data-anime4k-native-video';
const NATIVE_DOCUMENT_ATTRIBUTE = 'data-anime4k-native-document';
const NATIVE_KEEP_ATTRIBUTE = 'data-anime4k-native-keep';
const NATIVE_STYLE_ID = 'anime4k-native-isolation-style';

/** The marked page state of one active native capture session. */
export interface IsolationState {
  sessionId: string;
  nonce: string;
  originalTitle: string;
  root: HTMLElement;
  video: HTMLVideoElement | null;
  markedHosts: HTMLElement[];
  originalRootStyle?: string | null;
  originalVideoStyle?: string | null;
  captureStage?: IntrinsicCaptureStage;
}

interface DirectTitleState {
  sessionId: string;
  nonce: string;
  originalTitle: string;
}

/**
 * Owns the native capture isolation: marking the capture surface in the DOM,
 * hiding everything around it, nonce-marking the document title so the native
 * host can find its output window, and restoring the exact original state
 * when a session ends.
 *
 * The module also owns the DOM queries that locate videos and frames across
 * shadow boundaries, so every caller resolves the capture surface through one
 * interface instead of re-walking the tree itself.
 */
export class NativeIsolationSession {
  private isolation: IsolationState | null = null;
  private directTitle: DirectTitleState | null = null;
  private readonly restoreListeners = new Set<() => void>();

  /** Register a callback that runs after every restore. */
  onRestore(listener: () => void): void {
    this.restoreListeners.add(listener);
  }

  /** The active isolation state, if a session currently owns the page. */
  get active(): IsolationState | null {
    return this.isolation;
  }

  /** The video captured by the active isolation, if any. */
  get activeVideo(): HTMLVideoElement | null {
    return this.isolation?.video ?? null;
  }

  /** The capture root of the active isolation, if any. */
  get activeRoot(): HTMLElement | null {
    return this.isolation?.root ?? null;
  }

  /** The session ID of the active isolation, if any. */
  get isolationSessionId(): string | null {
    return this.isolation?.sessionId ?? null;
  }

  /** The session ID behind a direct-fullscreen title nonce, if any. */
  get directTitleSessionId(): string | null {
    return this.directTitle?.sessionId ?? null;
  }

  // ── Capture-surface queries ────────────────────────────────────────────

  findVideosDeep(root: Document | ShadowRoot = document): HTMLVideoElement[] {
    const videos: HTMLVideoElement[] = [];
    const elements = root.querySelectorAll('*');
    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index];
      if (element instanceof HTMLVideoElement) videos.push(element);
      if (element.shadowRoot) videos.push(...this.findVideosDeep(element.shadowRoot));
    }
    return videos;
  }

  findFramesDeep(root: Document | ShadowRoot = document): HTMLIFrameElement[] {
    const frames: HTMLIFrameElement[] = [];
    const elements = root.querySelectorAll('*');
    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index];
      if (element instanceof HTMLIFrameElement) frames.push(element);
      if (element.shadowRoot) frames.push(...this.findFramesDeep(element.shadowRoot));
    }
    return frames;
  }

  private visibleRect(element: Element): DOMRect | null {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || '1') > 0;
    return visible ? rect : null;
  }

  /** The video with the given ID, or the largest visible video on the page. */
  selectVideo(videoId?: string): HTMLVideoElement | null {
    const videos = this.findVideosDeep();
    if (videoId) {
      const exact = videos.find(video => video.getAttribute(VIDEO_ID_ATTRIBUTE) === videoId);
      if (exact) return exact;
    }
    let selected: HTMLVideoElement | null = null;
    let selectedArea = 0;
    for (const video of videos) {
      const rect = this.visibleRect(video);
      if (!rect) continue;
      const area = rect.width * rect.height;
      if (area > selectedArea) {
        selected = video;
        selectedArea = area;
      }
    }
    return selected;
  }

  private normalizeUrl(value: string): string | null {
    try {
      const url = new URL(value, document.baseURI);
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  }

  /** The iframe embedding the given source URL, or the largest visible frame. */
  selectSourceFrame(sourceUrl: string): HTMLIFrameElement | null {
    const target = this.normalizeUrl(sourceUrl);
    let selected: HTMLIFrameElement | null = null;
    let selectedArea = 0;
    for (const frame of this.findFramesDeep()) {
      const rect = this.visibleRect(frame);
      if (!rect) continue;
      if (this.normalizeUrl(frame.src) === target) return frame;
      const area = rect.width * rect.height;
      if (area > selectedArea) {
        selected = frame;
        selectedArea = area;
      }
    }
    return selected;
  }

  /**
   * The element to capture for a video. If this document owns a fullscreen
   * subtree containing the video, capture the whole subtree so site controls
   * remain part of the frame. For embedded/cross-origin players, choose the
   * compact local player surface; their document.fullscreenElement may be
   * null or unrelated to the video.
   */
  chooseCaptureRoot(video: HTMLVideoElement): HTMLElement {
    const fullscreenElement = document.fullscreenElement;
    const scope = selectNativeCaptureSurfaceScope({
      hasLocalFullscreenElement: fullscreenElement instanceof HTMLElement,
      fullscreenContainsVideo: fullscreenContainsVideo(fullscreenElement, video),
    });
    if (scope === 'fullscreen' && fullscreenElement instanceof HTMLElement) return fullscreenElement;
    return choosePlayerSurface(video, fullscreenElement);
  }

  /** The intrinsic capture stage geometry for a video. */
  intrinsicCaptureStage(video: HTMLVideoElement): IntrinsicCaptureStage {
    const rect = video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return calculateIntrinsicCaptureStage({
      intrinsicWidth: video.videoWidth || Math.round(rect.width * dpr),
      intrinsicHeight: video.videoHeight || Math.round(rect.height * dpr),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: dpr,
    });
  }

  // ── Isolation lifecycle ────────────────────────────────────────────────

  private ensureIsolationStyle(captureStage?: IntrinsicCaptureStage): void {
    const style = document.getElementById(NATIVE_STYLE_ID) as HTMLStyleElement | null
      ?? document.createElement('style');
    style.id = NATIVE_STYLE_ID;
    const rootGeometry = captureStage
      ? `
      inset: auto !important;
      left: ${captureStage.left}px !important;
      top: ${captureStage.top}px !important;
      right: auto !important;
      bottom: auto !important;
      width: ${captureStage.width}px !important;
      height: ${captureStage.height}px !important;`
      : `
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;`;
    style.textContent = `
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] {
      background: #000 !important;
      color-scheme: dark !important;
      overflow: hidden !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] body {
      background: #000 !important;
      overflow: hidden !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] body * {
      visibility: hidden !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_ROOT_ATTRIBUTE}],
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_ROOT_ATTRIBUTE}] *,
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_KEEP_ATTRIBUTE}],
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_KEEP_ATTRIBUTE}] * {
      visibility: visible !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] [${NATIVE_ROOT_ATTRIBUTE}] {
      position: fixed !important;
      ${rootGeometry}
      z-index: 2147483646 !important;
      display: block !important;
      box-sizing: border-box !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      border: 0 !important;
      transform: none !important;
      background: #000 !important;
      overflow: hidden !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] video[${NATIVE_VIDEO_ATTRIBUTE}]:not([${NATIVE_ROOT_ATTRIBUTE}]) {
      position: absolute !important;
      inset: 0 !important;
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: contain !important;
      background: #000 !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] video[${NATIVE_VIDEO_ATTRIBUTE}][${NATIVE_ROOT_ATTRIBUTE}] {
      object-fit: contain !important;
    }
    html[${NATIVE_DOCUMENT_ATTRIBUTE}] iframe[${NATIVE_ROOT_ATTRIBUTE}] {
      border: 0 !important;
    }
  `;
    if (!style.isConnected) (document.head ?? document.documentElement).appendChild(style);
  }

  activate(
    sessionId: string,
    nonce: string,
    root: HTMLElement,
    video: HTMLVideoElement | null,
    captureStage?: IntrinsicCaptureStage,
  ): IsolationState {
    if (this.isolation && this.isolation.sessionId !== sessionId) {
      this.restore(this.isolation.sessionId);
    }
    if (!this.isolation) {
      const markedHosts: HTMLElement[] = [];
      let containingRoot: Node = root.getRootNode();
      while (containingRoot instanceof ShadowRoot) {
        const host = containingRoot.host as HTMLElement;
        markedHosts.push(host);
        containingRoot = host.getRootNode();
      }
      this.isolation = {
        sessionId,
        nonce,
        originalTitle: document.title,
        root,
        video,
        markedHosts,
        originalRootStyle: root.getRootNode() instanceof ShadowRoot ? root.getAttribute('style') : undefined,
        originalVideoStyle: video?.getRootNode() instanceof ShadowRoot ? video.getAttribute('style') : undefined,
        captureStage,
      };
    } else {
      this.isolation.root = root;
      this.isolation.video = video;
      this.isolation.nonce = nonce;
      this.isolation.captureStage = captureStage;
    }
    this.ensureIsolationStyle(captureStage);
    document.documentElement.setAttribute(NATIVE_DOCUMENT_ATTRIBUTE, sessionId);
    root.setAttribute(NATIVE_ROOT_ATTRIBUTE, sessionId);
    video?.setAttribute(NATIVE_VIDEO_ATTRIBUTE, sessionId);
    this.isolation.markedHosts.forEach(host => host.setAttribute(NATIVE_KEEP_ATTRIBUTE, sessionId));

    // Document styles cannot cross a shadow boundary. Apply the same temporary
    // geometry directly for an open-shadow player and restore the exact inline
    // style when the session ends.
    if (root.getRootNode() instanceof ShadowRoot) {
      const geometry: Record<string, string> = captureStage
        ? {
            inset: 'auto', left: `${captureStage.left}px`, top: `${captureStage.top}px`,
            right: 'auto', bottom: 'auto', width: `${captureStage.width}px`, height: `${captureStage.height}px`,
          }
        : { inset: '0', width: '100vw', height: '100vh' };
      const rootStyle: Record<string, string> = {
        position: 'fixed', zIndex: '2147483646', display: 'block',
        'box-sizing': 'border-box', ...geometry, 'max-width': 'none',
        'max-height': 'none', margin: '0', border: '0', transform: 'none',
        background: '#000', overflow: 'hidden', visibility: 'visible',
      };
      Object.entries(rootStyle).forEach(([property, value]) => root.style.setProperty(property, value, 'important'));
    }
    if (video?.getRootNode() instanceof ShadowRoot) {
      const videoStyle: Record<string, string> = {
        width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none',
        'object-fit': 'contain', background: '#000', visibility: 'visible',
      };
      Object.entries(videoStyle).forEach(([property, value]) => video.style.setProperty(property, value, 'important'));
    }
    this.setNonceMarker(this.isolation);
    return this.isolation;
  }

  restore(sessionId?: string, originalTitle?: string): void {
    if (this.isolation && sessionId && this.isolation.sessionId !== sessionId) return;
    const state = this.isolation;

    document.documentElement.removeAttribute(NATIVE_DOCUMENT_ATTRIBUTE);
    document.querySelectorAll(`[${NATIVE_ROOT_ATTRIBUTE}]`).forEach(element => {
      element.removeAttribute(NATIVE_ROOT_ATTRIBUTE);
    });
    this.findVideosDeep().forEach(video => video.removeAttribute(NATIVE_VIDEO_ATTRIBUTE));
    document.getElementById(NATIVE_STYLE_ID)?.remove();

    if (state) {
      state.root.removeAttribute(NATIVE_ROOT_ATTRIBUTE);
      state.markedHosts.forEach(host => host.removeAttribute(NATIVE_KEEP_ATTRIBUTE));
      if (state.originalRootStyle !== undefined) {
        if (state.originalRootStyle === null) state.root.removeAttribute('style');
        else state.root.setAttribute('style', state.originalRootStyle);
      }
      if (state.video && state.originalVideoStyle !== undefined) {
        if (state.originalVideoStyle === null) state.video.removeAttribute('style');
        else state.video.setAttribute('style', state.originalVideoStyle);
      }
      const marker = `[AniWebScale:${state.nonce}]`;
      if (document.title.startsWith(marker)) document.title = state.originalTitle;
    } else if (originalTitle && document.title.startsWith('[AniWebScale:')) {
      document.title = originalTitle;
    }
    this.isolation = null;
    this.restoreListeners.forEach(listener => listener());
  }

  /**
   * Re-activate the isolation for a replacement video node. Player frameworks
   * swap the <video> element mid-session; the capture root and geometry are
   * recomputed while the original title survives.
   */
  reattachVideo(videoId: string, video: HTMLVideoElement): void {
    if (!this.isolation
        || videoId !== this.isolation.video?.getAttribute(VIDEO_ID_ATTRIBUTE)) return;
    const { sessionId, nonce, originalTitle, captureStage } = this.isolation;
    this.restore(sessionId, originalTitle);
    const nextStage = captureStage ? this.intrinsicCaptureStage(video) : undefined;
    const next = this.activate(
      sessionId,
      nonce,
      this.chooseCaptureRoot(video),
      video,
      nextStage,
    );
    next.originalTitle = originalTitle;
    this.setNonceMarker(next);
  }

  // ── Title nonce ────────────────────────────────────────────────────────

  private setNonceMarker(state: IsolationState): void {
    const marker = `[AniWebScale:${state.nonce}]`;
    if (!document.title.startsWith(marker)) document.title = `${marker} ${state.originalTitle}`;
  }

  /**
   * Mark the document title for a direct-fullscreen capture (no isolation).
   * Returns the original title so the host can restore it later.
   */
  setDirectNonceTitle(sessionId: string, nonce: string): string {
    if (this.directTitle && this.directTitle.sessionId !== sessionId) this.restoreDirectTitle();
    this.directTitle ??= { sessionId, nonce, originalTitle: document.title };
    this.directTitle.nonce = nonce;
    const marker = `[AniWebScale:${nonce}]`;
    if (!document.title.startsWith(marker)) document.title = `${marker} ${this.directTitle.originalTitle}`;
    return this.directTitle.originalTitle;
  }

  restoreDirectTitle(sessionId?: string, originalTitle?: string): void {
    if (this.directTitle && sessionId && this.directTitle.sessionId !== sessionId) return;
    if (this.directTitle) {
      const marker = `[AniWebScale:${this.directTitle.nonce}]`;
      if (document.title.startsWith(marker)) document.title = this.directTitle.originalTitle;
    } else if (originalTitle && document.title.startsWith('[AniWebScale:')) {
      document.title = originalTitle;
    }
    this.directTitle = null;
  }

  /**
   * Apply a title nonce for a session. Direct-fullscreen sessions mark the
   * title alone; other sessions update the active isolation or adopt the
   * document body as a minimal isolation root.
   */
  applyNonceTitle(
    sessionId: string,
    nonce: string,
    captureKind?: string,
  ): { originalTitle?: string } {
    if (captureKind === 'direct-fullscreen') {
      return { originalTitle: this.setDirectNonceTitle(sessionId, nonce) };
    }
    if (this.isolation?.sessionId === sessionId) {
      this.isolation.nonce = nonce;
      this.setNonceMarker(this.isolation);
    } else if (document.body) {
      this.isolation = {
        sessionId,
        nonce,
        originalTitle: document.title,
        root: document.body,
        video: this.selectVideo(),
        markedHosts: [],
      };
      this.setNonceMarker(this.isolation);
    }
    return { originalTitle: this.isolation?.originalTitle };
  }
}
