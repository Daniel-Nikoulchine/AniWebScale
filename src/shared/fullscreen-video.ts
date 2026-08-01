import { ANIME4K_APPLIED_ATTR, ANIME4K_FULLSCREEN_DOCUMENT_ATTR } from '../constants';

/**
 * Tracks whether the Fullscreen API is currently active on this page.
 * Set to true when a non-null fullscreenElement is observed, reset to false
 * when fullscreenchange fires with a null element. This ensures the geometry
 * fallback is only blocked immediately after an explicit API exit, not
 * permanently (which would break CSS fullscreen in SPAs like YouTube/Netflix).
 */
let fullscreenApiActive = false;

/** Reset the fullscreen API tracking state. Used by tests. */
export function resetFullscreenApiTracking(): void {
  fullscreenApiActive = false;
}

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

/**
 * Players such as Crunchyroll run their <video> inside a cross-origin iframe
 * while requesting Fullscreen from the top-level document. An enhancer living in
 * that iframe never sees document.fullscreenElement (it belongs to the parent)
 * and never receives the frame-local fullscreenchange event. Resolve the
 * authoritative top-level fullscreen element so the video can still be matched
 * against the real fullscreen subtree.
 */
export function getAuthoritativeFullscreenElement(): Element | null {
  if (window.top === window || !window.top) return getFullscreenElement();
  try {
    return getFullscreenElement(window.top.document);
  } catch {
    // Cross-origin top documents throw on property access. The local fullscreen
    // element is authoritative in that case (the guest cannot observe the parent).
    return getFullscreenElement();
  }
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
  // A player may request Fullscreen from the top-level document while its
  // <video> lives in a (possibly cross-origin) iframe. The local
  // document.fullscreenElement is then null, so resolve the authoritative
  // top-level element before the local one.
  const fullscreen = getAuthoritativeFullscreenElement();
  if (fullscreen) fullscreenApiActive = true;
  if (isFullscreenVideoEligible(fullscreen, video)) return true;
  // When the Fullscreen API was active and the element just became null, the
  // player explicitly exited fullscreen (minimize button, Esc, etc.). Block
  // the geometry fallback for THIS call so the native renderer stops, then
  // reset the flag so a later CSS fullscreen can still use the fallback.
  if (fullscreenApiActive && !fullscreen) {
    fullscreenApiActive = false;
    return false;
  }
  // A top-level document must have an actual Fullscreen API element. Without
  // this guard, Anime4K's own fixed fullscreen layout can keep satisfying the
  // geometry test after document.exitFullscreen(), causing a start/stop loop.
  // Embedded player frames may not expose the parent document's fullscreen
  // stack, so they retain the strict viewport/video geometry fallback.
  // Top-level pages using CSS fullscreen (no requestFullscreen call) also
  // need the geometry fallback; allow it unless the extension's own layout
  // is active, which would cause the loop described above.
  const ownLayoutActive = document.documentElement?.hasAttribute(ANIME4K_FULLSCREEN_DOCUMENT_ATTR) ?? false;
  if (!allowGeometryFallback && ownLayoutActive) return false;
  if (!isVisibleVideo(video, video.getAttribute(ANIME4K_APPLIED_ATTR) === 'true')) return false;
  // When the visible fullscreen element belongs to the top-level document,
  // measure against the top-level viewport rather than the (clipped) iframe.
  const topDocument = window.top?.document;
  const viewport = topDocument
    ? { width: topDocument.documentElement.clientWidth, height: topDocument.documentElement.clientHeight }
    : { width: window.innerWidth, height: window.innerHeight };
  const display = topDocument
    ? {
        width: window.top!.screen.width,
        height: window.top!.screen.height,
        availWidth: window.top!.screen.availWidth,
        availHeight: window.top!.screen.availHeight,
      }
    : {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
      };
  return viewportOccupiesScreen(viewport, display)
    && rectOccupiesViewport(video.getBoundingClientRect(), viewport);
}
