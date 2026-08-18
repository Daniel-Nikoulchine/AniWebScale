/**
 * The background half of fullscreen-triggered player access.
 *
 * One entry point per request (handle) with an explicit pre-check phase and
 * a fire-and-forget completion phase (complete). The pre-check phase decides
 * the reply the requesting frame acts on immediately:
 *
 * - 'injected': the player origin was already granted; scripts were injected
 *   into the tab right away. Fullscreen can stay.
 * - 'prompting': a permission prompt follows; the frame should exit
 *   fullscreen so the prompt is visible.
 * - 'suppressed': a prompt for this origin is already pending or was
 *   answered recently; nothing happens.
 *
 * The completion phase runs the actual permission request, mirrors a grant
 * into the persistent content-script registration and injects the scripts
 * into the requesting tab. The final outcome is reported back to the tab so
 * the page can explain itself.
 *
 * All chrome.* access goes through IframeSiteAccessDeps so the state machine
 * is testable with fakes.
 */
import { sitePatternForUrl } from '../site-access';

export type FrameAccessOutcome = 'injected' | 'prompting' | 'suppressed';

export type FrameAccessResultOutcome = 'granted' | 'denied' | 'failed';

export interface FrameAccessReply {
  ok: boolean;
  outcome?: FrameAccessOutcome;
  message?: string;
}

export interface IframeSiteAccessDeps {
  /** chrome.permissions.contains for origin patterns. */
  contains(patterns: string[]): Promise<boolean>;
  /** chrome.permissions.request for origin patterns. */
  request(patterns: string[]): Promise<boolean>;
  /** Mirror granted origins into the persistent script registration. */
  synchronize(): Promise<void>;
  /** Inject the site scripts into a tab (all frames, top-frame fallback). */
  inject(tabId: number): Promise<boolean>;
  /** Tell the tab what happened so the page can show a notice. */
  notify(tabId: number, origin: string, outcome: FrameAccessResultOutcome, applied?: boolean): void;
  /** Open the manual grant popup when the prompt cannot be shown directly. */
  openGrantPage(origin: string, tabId?: number): void;
  /** Current time in milliseconds. */
  now(): number;
}

export class IframeSiteAccessManager {
  /** Origin patterns that were prompted recently, for spam protection. */
  private readonly lastPrompted = new Map<string, number>();
  /** Origin patterns with a prompt in flight, for duplicate protection. */
  private readonly pending = new Map<string, number>();
  /** In-flight completion phases; tests await these via settled(). */
  private readonly completions = new Set<Promise<void>>();

  constructor(
    private readonly deps: IframeSiteAccessDeps,
    private readonly cooldownMs = 10_000,
    private readonly stalePendingMs = 45_000,
  ) {}

  /**
   * The immediate pre-check. Never blocks on a permission decision: the
   * requesting frame gets its reply before any prompt appears.
   */
  async handle(origin: string, tabId?: number): Promise<FrameAccessReply> {
    const pattern = sitePatternForUrl(origin);
    if (!pattern) return { ok: false, message: 'Unsupported player origin.' };

    if (await this.deps.contains([pattern])) {
      if (tabId !== undefined) {
        try {
          await this.deps.inject(tabId);
        } catch {
          // The persistent registration still covers future navigations.
        }
      }
      return { ok: true, outcome: 'injected' };
    }

    const now = this.deps.now();
    const pendingAt = this.pending.get(pattern);
    if (pendingAt !== undefined) {
      if (now - pendingAt < this.stalePendingMs) {
        // A prompt for this origin is already showing; one doorhanger is enough.
        return { ok: true, outcome: 'suppressed' };
      }
      this.pending.delete(pattern);
    }
    const lastPrompted = this.lastPrompted.get(pattern);
    if (lastPrompted !== undefined && now - lastPrompted < this.cooldownMs) {
      // Recently prompted or answered: do not re-open the prompt on every
      // fullscreen toggle.
      return { ok: true, outcome: 'suppressed' };
    }

    this.lastPrompted.set(pattern, now);
    this.pending.set(pattern, now);
    this.schedule(pattern, origin, tabId);
    return { ok: true, outcome: 'prompting' };
  }

  /** Await every in-flight completion phase. Used by tests. */
  async settled(): Promise<void> {
    await Promise.all([...this.completions]);
  }

  private schedule(pattern: string, origin: string, tabId?: number): void {
    let completion: Promise<void>;
    completion = this.complete(pattern, origin, tabId)
      .catch(error => {
        console.error('[AniWebScale] Player access request failed.', error);
      })
      .finally(() => {
        this.completions.delete(completion);
      });
    this.completions.add(completion);
  }

  /**
   * Run the permission request and its follow-ups. Guarded so every outcome
   * clears the pending state and reports back to the tab exactly once.
   */
  private async complete(pattern: string, origin: string, tabId?: number): Promise<void> {
    let granted: boolean;
    try {
      granted = await this.deps.request([pattern]);
    } catch {
      // The engine refused the prompt outside a user gesture (Chrome) or the
      // call failed. Route through the manual grant page instead.
      this.pending.delete(pattern);
      if (tabId !== undefined) this.deps.notify(tabId, origin, 'failed');
      this.deps.openGrantPage(origin, tabId);
      return;
    }
    this.pending.delete(pattern);

    if (!granted) {
      if (tabId !== undefined) this.deps.notify(tabId, origin, 'denied');
      return;
    }

    try {
      await this.deps.synchronize();
    } catch (error) {
      console.error('[AniWebScale] Could not register scripts for the granted player origin.', error);
    }
    if (tabId !== undefined) {
      let applied = false;
      try {
        applied = await this.deps.inject(tabId);
      } catch (error) {
        console.error('[AniWebScale] Could not inject scripts into the player frame.', error);
      }
      this.deps.notify(tabId, origin, 'granted', applied);
    }
  }
}
