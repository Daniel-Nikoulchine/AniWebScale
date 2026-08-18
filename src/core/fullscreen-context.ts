import {
  getAuthoritativeFullscreenElement,
  isVideoInFullscreenContext,
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
 * frames), one authoritative element, one context verdict. Overlay, layout
 * and enhancer consume this instead of each re-deriving it from the DOM.
 */
export class FullscreenContext {
  private readonly listeners = new Set<() => void>();
  private installed = false;
  private readonly change = () => {
    for (const listener of [...this.listeners]) listener();
  };

  /** The fullscreen element that governs this document, top-level included. */
  get element(): Element | null {
    return getAuthoritativeFullscreenElement();
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

  private removeFullscreenChangeListeners(): void {
    document.removeEventListener('fullscreenchange', this.change);
    document.removeEventListener('webkitfullscreenchange', this.change);
    try {
      if (window.top && window.top !== window) {
        window.top.removeEventListener('fullscreenchange', this.change);
        window.top.removeEventListener('webkitfullscreenchange', this.change);
      }
    } catch {
      // Cross-origin parent.
    }
  }

  /** Be notified on every fullscreen change that concerns this document. */
  subscribe(listener: () => void): () => void {
    this.install();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private install(): void {
    if (this.installed || typeof document?.addEventListener !== 'function') return;
    this.installed = true;
    this.installFullscreenChangeListeners();
  }
}

/** The fullscreen context of the current document. */
export const fullscreenContext = new FullscreenContext();
