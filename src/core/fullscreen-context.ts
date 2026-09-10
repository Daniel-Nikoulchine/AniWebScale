import {
  fullscreenContainsVideo,
  getAuthoritativeFullscreenElement,
  isVideoInFullscreenContext,
  isWithinFullscreenExitGrace,
  videoFillsOwnViewport,
} from '../shared/fullscreen-video';

export interface FullscreenCandidate {
  video: HTMLVideoElement;
  videoId: string;
}

/**
 * Elect the one video the enhancement should run on: every candidate in a
 * fullscreen context competes by rendered area; a perfect tie is broken by
 * the lower video id so the choice is deterministic across reconciles.
 *
 * A fullscreen context here is either the explicit kind (the Fullscreen API
 * subtree, including frame-level geometry) or the embedded-player kind: a
 * video that fills its own frame's viewport — how cross-origin hoster
 * players (VOE, Doodstream, ...) look from inside their iframe, where the
 * embedding page's fullscreen state is unreachable and usually unset.
 */
export function electFullscreenCandidate(
  candidates: readonly FullscreenCandidate[],
): FullscreenCandidate | null {
  let winner: FullscreenCandidate | null = null;
  let winnerArea = 0;
  for (const candidate of candidates) {
    if (!candidate.video.isConnected) continue;
    if (!isVideoInFullscreenContext(candidate.video)
        && !videoFillsOwnViewport(candidate.video)) continue;
    const rect = candidate.video.getBoundingClientRect();
    const area = rect.width * rect.height;
    // Zero-area videos (display:none inside the fullscreen subtree) are not
    // enhanceable: without this the first such candidate wins via !winner.
    if (!(area > 0)) continue;
    if (!winner || area > winnerArea
        || (area === winnerArea && candidate.videoId < winner.videoId)) {
      winner = candidate;
      winnerArea = area;
    }
  }
  return winner;
}

/**
 * The per-document owner of the fullscreen decision: one subscription point
 * for fullscreenchange (including the top-level document seen from guest
 * frames), one authoritative element, one candidate election, one context
 * verdict. Overlay, layout and enhancer consume this instead of each
 * re-deriving it from the DOM.
 */
export class FullscreenContext {
  private readonly listeners = new Set<() => void>();
  private installed = false;
  /**
   * The authoritative element observed at the last fullscreenchange (or the
   * first read). Stored rather than re-probed on every access: the change
   * event is the mutation source, so consumers read one cached verdict.
   */
  private elementCache: Element | null | undefined = undefined;
  private candidateSource: (() => readonly FullscreenCandidate[]) | null = null;
  private readonly change = () => {
    this.elementCache = getAuthoritativeFullscreenElement();
    for (const listener of [...this.listeners]) listener();
  };

  /** The fullscreen element that governs this document, top-level included. */
  get element(): Element | null {
    if (this.elementCache === undefined) {
      this.elementCache = getAuthoritativeFullscreenElement();
    }
    return this.elementCache;
  }

  /**
   * Register the page's candidate source. The population module feeds the
   * context its managed videos so election has exactly one owner.
   */
  setCandidateSource(source: () => readonly FullscreenCandidate[]): void {
    this.candidateSource = source;
  }

  /** The single elected video for the current fullscreen context, or null. */
  preferredVideo(): HTMLVideoElement | null {
    const candidates = this.candidateSource?.() ?? [];
    return electFullscreenCandidate(candidates)?.video ?? null;
  }

  /**
   * Whether the document is in any fullscreen context (explicit element or,
   * for embedded frames, the strict geometry fallback) that could host the
   * given video.
   */
  hasContext(video: HTMLVideoElement): boolean {
    return isVideoInFullscreenContext(video);
  }

  /**
   * Whether the video shows a player-fullscreen signal: it lives in the
   * explicit fullscreen subtree, or (outside the post-exit grace) it is the
   * embedded-style full-viewport player. The context owns this derivation so
   * consumers do not re-read the DOM.
   */
  hasPlayerSignal(video: HTMLVideoElement): boolean {
    const fullscreen = this.element;
    if (fullscreenContainsVideo(fullscreen, video)) return true;
    if (isWithinFullscreenExitGrace()) return false;
    // Deliberately the loose embedded-style signal (not the strict
    // screen-geometry predicate): top-level CSS-fullscreen players (theater
    // layouts that never call requestFullscreen) rely on it, and the election
    // additionally requires preferred-candidate status. Delegating to the full
    // isVideoInFullscreenContext here would pull its DOM/screen requirements
    // and exit-grace side effects into every reconcile.
    return videoFillsOwnViewport(video);
  }

  /**
   * The page owns the player iframe, but the video element lives in that
   * frame. Listening only to the frame's fullscreenchange misses the common
   * case where the parent document owns fullscreen. Subscribe in both places
   * when same-origin access permits it. Cross-origin frames still receive the
   * top-level event through the browser's frame propagation where supported;
   * the postMessage bridge below covers the player-origin signal.
   */
  private installFullscreenChangeListeners(): void {
    document.addEventListener('fullscreenchange', this.change);
    document.addEventListener('webkitfullscreenchange', this.change);
    try {
      if (window.top && window.top !== window) {
        window.top.addEventListener('fullscreenchange', this.change);
        window.top.addEventListener('webkitfullscreenchange', this.change);
      }
    } catch {
      // Cross-origin parent. The local listener remains useful for player-owned fullscreen.
    }
  }

  private uninstallFullscreenChangeListeners(): void {
    document.removeEventListener('fullscreenchange', this.change);
    document.removeEventListener('webkitfullscreenchange', this.change);
    try {
      if (window.top && window.top !== window) {
        window.top.removeEventListener('fullscreenchange', this.change);
        window.top.removeEventListener('webkitfullscreenchange', this.change);
      }
    } catch {
      // Cross-origin parent: nothing to remove.
    }
  }

  /** Be notified on every fullscreen change that concerns this document. */
  subscribe(listener: () => void): () => void {
    this.install();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      // Last subscriber out removes the document/window.top listeners so
      // iframe content scripts don't retain a cross-realm window reference
      // past unload.
      if (this.listeners.size === 0) {
        this.uninstallFullscreenChangeListeners();
        this.installed = false;
      }
    };
  }

  private install(): void {
    if (this.installed || typeof document?.addEventListener !== 'function') return;
    this.installed = true;
    // Seed the cached element at install time; the change event refreshes it.
    this.elementCache = getAuthoritativeFullscreenElement();
    this.installFullscreenChangeListeners();
  }
}

/** The fullscreen context of the current document. */
export const fullscreenContext = new FullscreenContext();
