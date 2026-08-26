import { debug } from './utils/debug-log';

const REGISTERED_SCRIPT_IDS = [
  'aniwebscale-fullscreen-bridge',
  'aniwebscale-content',
] as const;

function sameStrings(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function desiredContentScripts(matches: string[]): chrome.scripting.RegisteredContentScript[] {
  return [
    {
      id: REGISTERED_SCRIPT_IDS[0], matches, js: ['fullscreen-bridge.js'],
      runAt: 'document_start', allFrames: true, matchOriginAsFallback: true,
      persistAcrossSessions: true, world: 'MAIN',
    },
    {
      id: REGISTERED_SCRIPT_IDS[1], matches, js: ['content.js'],
      runAt: 'document_idle', allFrames: true, matchOriginAsFallback: true,
      persistAcrossSessions: true, world: 'ISOLATED',
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
    const injections = [
      { files: ['fullscreen-bridge.js'], world: 'MAIN' as const },
      { files: ['content.js'], world: 'ISOLATED' as const },
    ];

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
