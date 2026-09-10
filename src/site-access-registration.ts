import { debug } from './utils/debug-log';

/**
 * The one ordered source of the site scripts. The persistent content-script
 * registration and the immediate injection both derive from this table, so
 * the files, ids, worlds and run order can never drift apart.
 */
const SITE_SCRIPTS = [
  {
    id: 'aniwebscale-fullscreen-bridge',
    file: 'fullscreen-bridge.js',
    world: 'MAIN',
    runAt: 'document_start',
  },
  {
    id: 'aniwebscale-content',
    file: 'content.js',
    world: 'ISOLATED',
    runAt: 'document_idle',
  },
] as const;

const REGISTERED_SCRIPT_IDS = SITE_SCRIPTS.map(script => script.id);

function sameStrings(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function desiredContentScripts(matches: string[]): chrome.scripting.RegisteredContentScript[] {
  return SITE_SCRIPTS.map(script => ({
    id: script.id, matches, js: [script.file],
    runAt: script.runAt, allFrames: true, matchOriginAsFallback: true,
    persistAcrossSessions: true, world: script.world,
  }));
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

export class SiteAccessRegistration {
  constructor(private readonly getGrantedPatterns: () => Promise<string[]>) {}

  async synchronize(): Promise<void> {
    const matches = await this.getGrantedPatterns();
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [...REGISTERED_SCRIPT_IDS] });
    if (matches.length === 0) {
      if (existing.length > 0) await chrome.scripting.unregisterContentScripts({ ids: existing.map(script => script.id) });
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

  async inject(tabId: number): Promise<boolean> {
    const injections = SITE_SCRIPTS.map(script => ({
      files: [script.file],
      world: script.world,
    }));

    try {
      for (const injection of injections) {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true }, files: injection.files, world: injection.world,
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
            target: { tabId, frameIds: [frame.frameId] }, files: injection.files, world: injection.world,
          });
          injectedAny = true;
        } catch (error) {
          debug('Per-frame injection failed (tab %d, frame %d): %s', tabId, frame.frameId, errorMessage(error));
        }
      }
    }
    return injectedAny;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
