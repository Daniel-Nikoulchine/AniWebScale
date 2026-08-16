const SITE_ACCESS_MIGRATION_KEY = 'anime4kGranularSiteAccessV2';
const LEGACY_BROAD_PATTERNS = ['http://*/*', 'https://*/*'];
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

export function sitePatternForUrl(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

export async function getGrantedSitePatterns(): Promise<string[]> {
  const granted = await chrome.permissions.getAll();
  return [...new Set((granted.origins ?? []).filter(isHttpMatchPattern))].sort();
}

export async function hasSiteAccess(input: string | undefined): Promise<boolean> {
  const pattern = sitePatternForUrl(input);
  return pattern ? chrome.permissions.contains({ origins: [pattern] }) : false;
}

export async function requestSiteAccess(input: string | undefined): Promise<boolean> {
  const pattern = sitePatternForUrl(input);
  return pattern ? chrome.permissions.request({ origins: [pattern] }) : false;
}

export async function removeSiteAccess(input: string | undefined): Promise<boolean> {
  const pattern = sitePatternForUrl(input);
  return pattern ? chrome.permissions.remove({ origins: [pattern] }) : false;
}

export async function removeSiteAccessPatterns(patterns: string[]): Promise<boolean> {
  const origins = [...new Set(patterns.filter(isHttpMatchPattern))];
  return origins.length > 0 ? chrome.permissions.remove({ origins }) : false;
}

/**
 * Site access is granted per origin again. Users who previously allowed all
 * websites at once (or carried blanket grants over from the manifest-declared
 * host_permissions era) must not silently keep that access: strip the broad
 * patterns once so every site has to be approved individually. Per-site
 * grants survive.
 */
export async function migrateLegacyBroadSiteAccess(): Promise<void> {
  const stored = await chrome.storage.local.get(SITE_ACCESS_MIGRATION_KEY);
  if (stored[SITE_ACCESS_MIGRATION_KEY] === true) return;

  const granted = await getGrantedSitePatterns();
  const legacy = LEGACY_BROAD_PATTERNS.filter(pattern => granted.includes(pattern));
  if (legacy.length > 0) await chrome.permissions.remove({ origins: legacy });
  await chrome.storage.local.set({ [SITE_ACCESS_MIGRATION_KEY]: true });
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

export async function injectSiteScripts(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['fullscreen-bridge.js'],
    world: 'MAIN',
  });
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['content.js'],
    world: 'ISOLATED',
  });
}
