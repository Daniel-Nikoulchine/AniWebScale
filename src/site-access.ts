const REGISTERED_SCRIPT_IDS = [
  'aniwebscale-fullscreen-bridge',
  'aniwebscale-content',
] as const;

function isHttpMatchPattern(pattern: string): boolean {
  return /^https?:\/\/[^/]+\/\*$/.test(pattern);
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

export async function migrateLegacyBroadSiteAccess(): Promise<void> {
  // Content scripts are now declared directly in manifest.json with
  // host_permissions for all sites. The legacy migration that removed broad
  // optional permissions is no longer needed and must not run, otherwise it
  // would strip the host_permissions that the manifest-declared scripts rely on.
}

export async function synchronizeRegisteredContentScripts(): Promise<void> {
  // Content scripts are declared in manifest.json. Dynamic registration via
  // chrome.scripting is no longer used. Clean up any stale registrations from
  // previous versions so they don't conflict with the manifest-declared ones.
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [...REGISTERED_SCRIPT_IDS],
    });
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: existing.map(script => script.id) });
    }
  } catch {
    // Ignore errors during cleanup.
  }
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
