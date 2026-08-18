import { parseStatusResponse, siteAccessSyncMessage } from './shared/runtime-messages';
import { debug } from './utils/debug-log';

const REGISTERED_SCRIPT_IDS = [
  'aniwebscale-fullscreen-bridge',
  'aniwebscale-content',
] as const;

function isHttpMatchPattern(pattern: string): boolean {
  return /^https?:\/\/[^/]+\/\*$/.test(pattern);
}

function sameStrings(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length !== right.length) return false;
  return [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function desiredContentScripts(matches: string[]): chrome.scripting.RegisteredContentScript[] {
  return [
    {
      id: REGISTERED_SCRIPT_IDS[0],
      matches,
      js: ['fullscreen-bridge.js'],
      runAt: 'document_start',
      allFrames: true,
      matchOriginAsFallback: true,
      persistAcrossSessions: true,
      world: 'MAIN',
    },
    {
      id: REGISTERED_SCRIPT_IDS[1],
      matches,
      js: ['content.js'],
      runAt: 'document_idle',
      allFrames: true,
      matchOriginAsFallback: true,
      persistAcrossSessions: true,
      world: 'ISOLATED',
    },
  ];
}

function sameRegistration(
  actual: chrome.scripting.RegisteredContentScript,
  desired: chrome.scripting.RegisteredContentScript,
): boolean {
  return actual.id === desired.id
    && sameStrings(actual.matches, desired.matches ?? [])
    && sameStrings(actual.js, desired.js ?? [])
    && actual.runAt === desired.runAt
    && actual.allFrames === desired.allFrames
    && actual.matchOriginAsFallback === desired.matchOriginAsFallback
    && actual.persistAcrossSessions === desired.persistAcrossSessions
    && actual.world === desired.world;
}

/**
 * Reduce a URL to the origin pattern used for site-access grants. The pattern
 * is always portless: Firefox rejects port numbers in match patterns
 * (MDN: match patterns, "Port numbers"), which would make every permissions
 * call for ported origins throw, while Chrome reads a portless host as
 * matching any port.
 */
export function sitePatternForUrl(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return null;
  }
}

/** Broad wildcard grants whose host is a bare `*`, covering every site. */
export function isBroadSitePattern(pattern: string): boolean {
  return /^https?:\/\/\*\/\*$/.test(pattern);
}

/**
 * Every granted http(s) origin pattern, broad wildcards and per-site origins
 * alike. Broad grants carried over from the blanket-permissions era stay
 * functional: silently stripping them would leave the extension inert on
 * every site the user never explicitly re-approved.
 */
export async function getGrantedSitePatterns(): Promise<string[]> {
  const granted = await chrome.permissions.getAll();
  return [...new Set((granted.origins ?? []).filter(isHttpMatchPattern))].sort();
}

export async function requestSiteAccess(input: string | undefined): Promise<boolean> {
  const pattern = sitePatternForUrl(input);
  if (!pattern) return false;
  if (isBroadSitePattern(pattern)) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

export async function removeSiteAccess(input: string | undefined): Promise<boolean> {
  const pattern = sitePatternForUrl(input);
  return pattern ? chrome.permissions.remove({ origins: [pattern] }) : false;
}

export async function removeSiteAccessPatterns(patterns: string[]): Promise<boolean> {
  const origins = [...new Set(patterns.filter(isHttpMatchPattern))];
  return origins.length > 0 ? chrome.permissions.remove({ origins }) : false;
}

// ── The operations: one home per user-visible verb ───────────────────────

export type SiteAccessClassification = 'own' | 'broad' | 'none';

export interface SiteAccessStatus {
  access: SiteAccessClassification;
  /** The broad wildcard grants covering every site, when access is 'broad'. */
  covering: string[];
}

/**
 * Classify how a URL may be enhanced today: an own per-origin grant, a
 * wildcard grant carried over from the blanket-permissions era, or nothing.
 * Returns null for URLs site access cannot apply to at all.
 */
export async function describeSiteAccess(input: string | undefined): Promise<SiteAccessStatus | null> {
  const pattern = sitePatternForUrl(input);
  if (!pattern) return null;
  const granted = await getGrantedSitePatterns();
  const covering = granted.filter(isBroadSitePattern);
  return {
    access: isBroadSitePattern(pattern) || covering.length > 0 ? 'broad'
      : granted.includes(pattern) ? 'own' : 'none',
    covering,
  };
}

/**
 * Ask the background to mirror granted origins into the persistent content
 * script registration. The background's siteAccessChain serializes these
 * requests; callers never register on their own.
 */
async function synchronizeSiteAccess(): Promise<void> {
  const response = await chrome.runtime.sendMessage(siteAccessSyncMessage());
  const status = parseStatusResponse(response);
  if (!status.ok) throw new Error(status.message || 'Site access could not be applied.');
}

export type SiteAccessGrantOutcome = 'injected' | 'reload-required' | 'denied';

/**
 * Enumerate the frames in a tab and return the site-access patterns of every
 * cross-origin http(s) frame. These are player-host origins that should be
 * auto-granted alongside the main site so the user does not need to approve
 * each hoster origin separately.
 */
export async function getPlayerFrameOrigins(tabId: number): Promise<string[]> {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames || frames.length <= 1) return [];

    const top = frames.find(f => f.frameId === 0);
    if (!top?.url) return [];
    const topOrigin = new URL(top.url).origin;

    const patterns = new Set<string>();
    for (const frame of frames) {
      if (frame.frameId === 0) continue;
      if (!frame.url || !frame.url.startsWith('http')) continue;
      try {
        const frameOrigin = new URL(frame.url).origin;
        if (frameOrigin !== topOrigin) {
          const pattern = sitePatternForUrl(frame.url);
          if (pattern) patterns.add(pattern);
        }
      } catch {
        // Invalid URL in this frame; skip.
      }
    }
    return [...patterns];
  } catch {
    // Frame enumeration unavailable (tab closed, missing permission, etc.).
    return [];
  }
}

/**
 * Grant access for a tab's origin (must run inside a user gesture) and make
 * it effective on the current navigation. After granting the main origin,
 * also auto-grants every cross-origin player frame in the tab so the user
 * does not need to approve each hoster separately.
 *
 * All origins are collected into one `chrome.permissions.request` call so
 * the browser shows a single combined prompt. The user's click on "Allow
 * this site" implies consent for the player iframes it embeds.
 *
 * IMPORTANT: `playerPatterns` must be collected BEFORE the user gesture
 * (e.g. during popup open). Calling `getPlayerFrameOrigins` inside this
 * function would introduce an `await` before `permissions.request`, which
 * causes Firefox to reject the request with "may only be called from a
 * user input handler".
 */
export async function grantSiteAccess(
  tab: { id?: number; url?: string },
  playerPatterns?: string[],
): Promise<SiteAccessGrantOutcome> {
  if (tab.id === undefined) return 'denied';

  const mainPattern = sitePatternForUrl(tab.url);
  if (!mainPattern) return 'denied';

  // Blanket grant already covers everything; just sync and inject.
  if (isBroadSitePattern(mainPattern)) {
    await synchronizeSiteAccess();
    return await injectSiteScripts(tab.id) ? 'injected' : 'reload-required';
  }

  // Collect all origins into one request: the main site plus any cross-origin
  // player frames visible in the tab. Use pre-collected patterns when provided
  // to avoid an await before permissions.request (Firefox gesture requirement).
  const allPatterns = [mainPattern];
  const collected = playerPatterns ?? await getPlayerFrameOrigins(tab.id);
  for (const pattern of collected) {
    if (!allPatterns.includes(pattern)) allPatterns.push(pattern);
  }

  const granted = await chrome.permissions.request({ origins: allPatterns });
  if (!granted) return 'denied';

  await synchronizeSiteAccess();
  return await injectSiteScripts(tab.id) ? 'injected' : 'reload-required';
}

/**
 * Revoke a URL's access: its own per-origin grant, or — when the origin is
 * only covered by wildcard grants — those wildcard grants as a whole.
 */
export async function revokeSiteAccess(input: string | undefined): Promise<boolean> {
  const status = await describeSiteAccess(input);
  if (!status || status.access === 'none') return false;
  const changed = status.access === 'own'
    ? await removeSiteAccess(input)
    : await removeSiteAccessPatterns(status.covering);
  if (!changed) return false;
  await synchronizeSiteAccess();
  return true;
}

/** Revoke explicit origin patterns and re-sync the registration. */
export async function revokeSiteAccessPatterns(patterns: string[]): Promise<boolean> {
  const changed = await removeSiteAccessPatterns(patterns);
  if (changed) await synchronizeSiteAccess();
  return changed;
}

/**
 * Mirror granted origins into persistent dynamic content scripts. Manifest
 * content_scripts cannot be scoped to runtime-granted optional origins on
 * Firefox, so registration is the cross-browser path for per-site approval.
 */
export async function synchronizeRegisteredContentScripts(): Promise<void> {
  const matches = await getGrantedSitePatterns();
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [...REGISTERED_SCRIPT_IDS],
  });

  if (matches.length === 0) {
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: existing.map(script => script.id) });
    }
    return;
  }

  const desired = desiredContentScripts(matches);
  const isCurrent = existing.length === desired.length
    && desired.every(script => existing.some(candidate => sameRegistration(candidate, script)));
  if (isCurrent) return;

  if (existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: existing.map(script => script.id) });
  }
  await chrome.scripting.registerContentScripts(desired);
}

/**
 * Immediately inject the site scripts into a tab. One frame the extension
 * may not script (a cross-origin iframe without its own grant, such as an
 * ad or analytics frame) rejects the whole all-frames call on both engines,
 * so the call falls back to per-frame injection: every http(s) frame is
 * attempted individually and unscriptable ones are skipped. Streaming sites
 * nearly always have a few unscriptable frames, and without this fallback
 * the player frame would silently never receive the scripts even though its
 * own origin is granted. The persistent registration covers every future
 * navigation either way. Returns whether at least one frame was scripted.
 */
export async function injectSiteScripts(tabId: number): Promise<boolean> {
  const injections = [
    { files: ['fullscreen-bridge.js'], world: 'MAIN' as const },
    { files: ['content.js'], world: 'ISOLATED' as const },
  ];

  // Fast path: every frame in the tab is scriptable.
  try {
    for (const injection of injections) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: injection.files,
        world: injection.world,
      });
    }
    return true;
  } catch {
    // Fall through to per-frame injection.
  }

  let frames: (chrome.webNavigation.GetAllFrameResultDetails & { url: string })[];
  try {
    const listed = await chrome.webNavigation.getAllFrames({ tabId });
    frames = (listed ?? []).filter((
      frame,
    ): frame is chrome.webNavigation.GetAllFrameResultDetails & { url: string } =>
      frame !== null && typeof frame.url === 'string' && /^https?:/.test(frame.url));
  } catch (error) {
    debug('Could not enumerate frames for tab %d: %s', tabId, errorMessage(error));
    return false;
  }

  let injectedAny = false;
  for (const frame of frames) {
    for (const injection of injections) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frame.frameId] },
          files: injection.files,
          world: injection.world,
        });
        injectedAny = true;
      } catch (error) {
        // This frame is not scriptable right now; the persistent
        // registration covers it on its next load.
        debug('Per-frame injection failed (tab %d, frame %d): %s', tabId, frame.frameId, errorMessage(error));
      }
    }
  }
  return injectedAny;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
