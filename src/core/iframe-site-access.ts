/**
 * Player-frame access for cross-origin embed players.
 *
 * Streaming sites like aniworld.to embed their video player in an iframe
 * served from another origin (voe.sx, doodstream, filemoon, vidmoly, ...).
 * A grant for the embedding site does not cover that frame, so nothing runs
 * there. The player frame also appears late: the page first shows an empty
 * iframe and points it at the hoster only after the user clicks a hoster
 * button, and embedded playback never fullscreens the iframe from the
 * embedding document. The probe therefore reports a player frame through
 * two triggers:
 *
 * - appearance: a visible, player-sized, cross-origin iframe appears in
 *   this document or navigates to a new src (the AniWorld late load);
 * - fullscreenchange: an iframe becomes this document's fullscreen element.
 *
 * The background answers 'injected' when the player origin was already
 * granted (scripts were pushed into the tab right away) or 'prompting' when
 * a permission prompt or the manual grant popup follows; the probe then
 * leaves fullscreen so that UI is visible instead of behind the player.
 */
import { getFullscreenElement } from '../shared/fullscreen-video';
import {
  parseSiteAccessIframeResponse,
  siteAccessIframeRequestMessage,
} from '../shared/runtime-messages';
import { getSettings } from '../utils/settings';

/** Client-rectangle bounds of an iframe treated as an embedded player. */
const PLAYER_IFRAME_MIN_WIDTH = 320;
const PLAYER_IFRAME_MIN_HEIGHT = 180;
/** Client aspect-ratio bounds of an iframe treated as an embedded player. */
const PLAYER_IFRAME_MIN_ASPECT = 1.4;
const PLAYER_IFRAME_MAX_ASPECT = 2.4;
/** How long one origin stays unreported after a report left this frame. */
const REPORT_DEDUPE_MS = 30_000;
/** Delayed re-check for iframes whose src arrived before their layout. */
const LATE_LAYOUT_RESCAN_MS = 1_000;
/** Cap on chained re-checks so a permanently empty iframe cannot loop. */
const LATE_LAYOUT_RESCAN_LIMIT = 5;
/** Internal attribute to track iframes with a load listener already attached. */
const IFRAME_WATCHED_ATTR = 'data-aniwebscale-iframes-watched';

let probeInstalled = false;
const reportedOrigins = new Map<string, number>();

/** True when the element is an iframe in this document's realm. */
function isIframeElement(element: Element | null): element is HTMLIFrameElement {
  if (!element || element.tagName !== 'IFRAME') return false;
  // In DOM-less test environments HTMLIFrameElement may not exist; the tag
  // name check above is then authoritative enough for the mocked elements.
  return typeof HTMLIFrameElement === 'undefined' || element instanceof HTMLIFrameElement;
}

/**
 * The http(s) origin of an iframe, or null when it cannot be the target of a
 * site-access grant. Only the src attribute is readable for cross-origin
 * frames, so that is the only signal available.
 */
export function iframeOriginForAccess(element: HTMLIFrameElement): string | null {
  const src = element.getAttribute('src') ?? element.src ?? '';
  if (!src) return null;
  try {
    const url = new URL(src, typeof location !== 'undefined' ? location.href : undefined);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** This frame's own origin, or null where it cannot be determined. */
function ownOrigin(): string | null {
  if (typeof location === 'undefined' || !location.origin) return null;
  return location.origin;
}

/**
 * Whether an iframe looks like an embedded player worth asking access for:
 * cross-origin, large, roughly video-shaped and actually shown. Ad frames
 * (300x250, 728x90, ...) and same-origin frames must never trigger a
 * permission popup — same-origin frames are covered by this document's own
 * grant through the all-frames registration.
 */
export function looksLikeEmbeddedPlayer(element: HTMLIFrameElement): boolean {
  const origin = iframeOriginForAccess(element);
  if (!origin || origin === ownOrigin()) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < PLAYER_IFRAME_MIN_WIDTH || rect.height < PLAYER_IFRAME_MIN_HEIGHT) return false;
  const aspect = rect.width / Math.max(1, rect.height);
  if (aspect < PLAYER_IFRAME_MIN_ASPECT || aspect > PLAYER_IFRAME_MAX_ASPECT) return false;
  if (typeof getComputedStyle !== 'function') return true;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Ask the background for access to a player origin. The reply 'prompting'
 * means permission UI follows; when this document is showing the player
 * iframe fullscreen, leave fullscreen so that UI is not hidden behind it.
 */
function requestPlayerFrameAccess(origin: string): void {
  void getSettings()
    .then(settings => {
      if (settings.extensionEnabled === false) return null;
      const now = Date.now();
      const lastReported = reportedOrigins.get(origin);
      if (lastReported !== undefined && now - lastReported < REPORT_DEDUPE_MS) return null;
      reportedOrigins.set(origin, now);
      return chrome.runtime.sendMessage(siteAccessIframeRequestMessage(origin));
    })
    .then(response => {
      if (!response) return;
      const parsed = parseSiteAccessIframeResponse(response);
      if (parsed.ok && parsed.outcome === 'prompting' && isIframeElement(getFullscreenElement())) {
        try {
          document.exitFullscreen()?.catch(() => undefined);
        } catch {
          // Best effort: some documents reject exitFullscreen without an
          // active fullscreen element. Nothing else to do.
        }
      }
    })
    .catch(() => undefined);
}

/**
 * Watch this document for embedded player iframes. AniWorld leaves the
 * player iframe empty at load and sets its src only when a hoster button
 * (VOE, Doodstream, Filemoon, Vidmoly) is clicked, so the interesting
 * moment is a src mutation or iframe insertion, not page load. Style and
 * class mutations re-run the scan because players are often revealed (and
 * sized) right after their src arrives.
 */
function installEmbeddedPlayerObserver(): void {
  if (typeof MutationObserver === 'undefined'
      || typeof document.querySelectorAll !== 'function'
      || !document.documentElement) return;

  let rescanTimer: ReturnType<typeof setTimeout> | undefined;
  let rescansLeft = LATE_LAYOUT_RESCAN_LIMIT;

  const scan = (): void => {
    let awaitingLayout = false;
    document.querySelectorAll('iframe').forEach(element => {
      if (!isIframeElement(element)) return;
      const origin = iframeOriginForAccess(element);
      if (!origin || origin === ownOrigin()) return;
      if (looksLikeEmbeddedPlayer(element)) {
        requestPlayerFrameAccess(origin);
        return;
      }
      // A src can arrive before the player box is laid out; the iframe then
      // sizes as 0x0 and would be dropped. Re-check it shortly instead.
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) awaitingLayout = true;
    });
    if (awaitingLayout && rescansLeft > 0) {
      rescansLeft -= 1;
      if (rescanTimer === undefined) {
        rescanTimer = setTimeout(() => {
          rescanTimer = undefined;
          scan();
        }, LATE_LAYOUT_RESCAN_MS);
      }
    }
  };

  /**
   * Attach a load listener to every iframe that is not yet watched. When the
   * iframe fires load (its content finished loading), re-scan — the player
   * may have just appeared. Also scan the newly added iframe right away in
   * case its src was already set before insertion.
   */
  function watchIframes(): void {
    document.querySelectorAll('iframe').forEach(element => {
      if (typeof element.hasAttribute !== 'function' || element.hasAttribute(IFRAME_WATCHED_ATTR)) return;
      element.setAttribute(IFRAME_WATCHED_ATTR, '');
      element.addEventListener('load', () => {
        rescansLeft = LATE_LAYOUT_RESCAN_LIMIT;
        scan();
      }, { once: true });
    });
  }

  const observer = new MutationObserver(() => {
    rescansLeft = LATE_LAYOUT_RESCAN_LIMIT;
    scan();
    watchIframes();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class'],
  });
  scan();
  watchIframes();
}

/**
 * Install the probe once per document. Runs in every frame that carries the
 * content script; embedded player iframes are reported from the frame that
 * owns them, and fullscreen reports also cover nested player frames.
 */
export function installIframeSiteAccessProbe(): void {
  if (probeInstalled) return;
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  probeInstalled = true;

  const onFullscreenChange = (): void => {
    const fullscreen = getFullscreenElement();
    if (!isIframeElement(fullscreen)) return;
    const origin = iframeOriginForAccess(fullscreen);
    if (!origin) return;
    requestPlayerFrameAccess(origin);
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  installEmbeddedPlayerObserver();
}
