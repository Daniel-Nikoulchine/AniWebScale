import { ANIME4K_APPLIED_ATTR } from '../constants';

/** True when the video belongs to the composed subtree placed in fullscreen. */
export function fullscreenContainsVideo(fullscreen: Element | null, video: HTMLVideoElement): boolean {
  if (!fullscreen) return false;
  let current: Node | null = video;
  while (current) {
    if (current === fullscreen) return true;
    if (current.parentNode) {
      current = current.parentNode;
      continue;
    }
    const root = current.getRootNode();
    current = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

export interface ViewportMetrics {
  width: number;
  height: number;
}

export interface ScreenMetrics {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
}

export interface ElementRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function getFullscreenElement(target: Document = document): Element | null {
  const fullscreenDocument = target as FullscreenDocument;
  return fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

export function viewportOccupiesScreen(viewport: ViewportMetrics, display: ScreenMetrics): boolean {
  const displayWidth = Math.max(display.width, display.availWidth);
  const displayHeight = Math.max(display.height, display.availHeight);
  if (displayWidth <= 0 || displayHeight <= 0) return false;
  return viewport.width >= displayWidth * 0.95
    && viewport.height >= displayHeight * 0.95;
}

/** True while the document is still in the same explicit or frame-level fullscreen context. */
export function hasFullscreenContext(
  fullscreen: Element | null,
  viewport: ViewportMetrics,
  display: ScreenMetrics,
  allowGeometryFallback = true,
): boolean {
  return Boolean(fullscreen)
    || allowGeometryFallback && viewportOccupiesScreen(viewport, display);
}

export function rectOccupiesViewport(rect: ElementRect, viewport: ViewportMetrics): boolean {
  if (viewport.width <= 0 || viewport.height <= 0) return false;
  const horizontalInset = viewport.width * 0.05;
  const verticalInset = viewport.height * 0.05;
  return rect.width >= viewport.width * 0.9
    && rect.height >= viewport.height * 0.9
    && rect.left <= horizontalInset
    && rect.top <= verticalInset
    && rect.right >= viewport.width - horizontalInset
    && rect.bottom >= viewport.height - verticalInset;
}

function isVisibleVideo(video: HTMLVideoElement, allowTransparent = false): boolean {
  if (!video.isConnected) return false;
  const rect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  return rect.width >= 240
    && rect.height >= 135
    && style.display !== 'none'
    && style.visibility !== 'hidden'
    && (allowTransparent || Number.parseFloat(style.opacity || '1') > 0);
}

export function isFullscreenVideoEligible(
  fullscreen: Element | null,
  video: HTMLVideoElement,
): boolean {
  if (!fullscreenContainsVideo(fullscreen, video)) return false;
  // Once Anime4K has rendered its first frame, OverlayManager deliberately
  // hides the source video behind the output canvas. Keep that already-active
  // video eligible while it remains in the browser's explicit fullscreen
  // subtree; otherwise a resize reconcile immediately tears the session down.
  return isVisibleVideo(video, video.getAttribute(ANIME4K_APPLIED_ATTR) === 'true');
}

/**
 * Some streaming players place their media in an origin-derived frame where
 * the isolated content world does not expose the page's fullscreen stack.
 * In that case the fullscreen frame and its video still occupy the physical
 * screen. The strict geometry fallback avoids treating ordinary maximized
 * browser playback as player fullscreen.
 */
export function isVideoInFullscreenContext(
  video: HTMLVideoElement,
  allowGeometryFallback = window.top !== window,
): boolean {
  if (isFullscreenVideoEligible(getFullscreenElement(), video)) return true;
  // A top-level document must have an actual Fullscreen API element. Without
  // this guard, Anime4K's own fixed fullscreen layout can keep satisfying the
  // geometry test after document.exitFullscreen(), causing a start/stop loop.
  // Embedded player frames may not expose the parent document's fullscreen
  // stack, so they retain the strict viewport/video geometry fallback.
  if (!allowGeometryFallback) return false;
  if (!isVisibleVideo(video, video.getAttribute(ANIME4K_APPLIED_ATTR) === 'true')) return false;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  return viewportOccupiesScreen(viewport, {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
  }) && rectOccupiesViewport(video.getBoundingClientRect(), viewport);
}
