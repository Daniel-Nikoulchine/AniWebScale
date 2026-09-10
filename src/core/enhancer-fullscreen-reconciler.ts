import { ANIME4K_FULLSCREEN_AUTO_ATTR } from '../constants';
import type { Anime4KWebExtSettings } from '../types';
import { isProcessingEnabled } from '../shared/presets';
import { fullscreenContext } from './fullscreen-context';

/** Fullscreen reconcile debounce after geometry/settings changes. */
export const FULLSCREEN_RECONCILE_DELAY_MS = 90;
/** Immediate reconcile for fullscreen events already serialized by the browser. */
export const FULLSCREEN_RECONCILE_IMMEDIATE_MS = 0;
/** Retry delay after a native exit that was not really a player fullscreen exit. */
export const FULLSCREEN_RECONCILE_RETRY_MS = 250;

/**
 * The narrow host seam the reconciler needs. The reconciler owns the debounce
 * timer, the automatic-session flag and the native-retry block; it calls back
 * into the enhancer to start/stop and to enter/exit the fullscreen layout.
 */
export interface FullscreenReconcilerContext {
  isDestroyed(): boolean;
  getVideo(): HTMLVideoElement;
  getSettings(): Anime4KWebExtSettings | null;
  setSettings(settings: Anime4KWebExtSettings): void;
  loadSettings(): Promise<Anime4KWebExtSettings>;
  hasRenderer(): boolean;
  isNativeActive(): boolean;
  isStarting(): boolean;
  hasActiveFallback(): boolean;
  hasPendingFallback(): boolean;
  enterLayout(): void;
  exitLayout(): void;
  start(settings: Anime4KWebExtSettings): Promise<void>;
  stop(): Promise<void>;
  /** Reconcile cancellation token, owned by the enhancer lifecycle. */
  beginReconcile(): number;
  isReconcileCurrent(token: number): boolean;
  /** Serialize with the enhancer lifecycle (settings/switch/reconcile). */
  enqueue(operation: () => Promise<void>): Promise<void>;
}

/**
 * The auto-fullscreen marker drives the page-bridge redirect
 * (video.requestFullscreen -> player surface), so it requires opted-in
 * automation, not just an enabled processing mode. A manual (popup-started)
 * session with autoFullscreenEnabled=false must not redirect site fullscreen
 * requests.
 */
export function shouldMarkAutoFullscreen(settings: Anime4KWebExtSettings | null): boolean {
  return settings !== null
    && settings.autoFullscreenEnabled
    && isProcessingEnabled(settings.mode, settings.frameGenerationEnabled);
}

/**
 * Owns the debounced fullscreen reconciliation: decide whether any managed
 * video should be enhanced, start/stop automatically, and keep the
 * auto-fullscreen marker in sync. The reconcile cancellation token itself
 * stays in EnhancerLifecycle (single lifecycle owner); this collaborator
 * drives it through the host seam.
 */
export class FullscreenReconciler {
  private debounceTimer?: number;
  private automaticSession = false;
  private nativeRetryBlocked = false;

  constructor(private readonly ctx: FullscreenReconcilerContext) {}

  /** Whether the current session was auto-started from a fullscreen reconcile. */
  get isAutomaticSession(): boolean {
    return this.automaticSession;
  }

  /** Drop the automatic-session flag on any explicit teardown. */
  resetAutomaticSession(): void {
    this.automaticSession = false;
  }

  /** Block auto-retry after a native terminal event that forbids it. */
  blockAutoRetry(): void {
    this.nativeRetryBlocked = true;
  }

  applyMarker(settings: Anime4KWebExtSettings | null): void {
    if (shouldMarkAutoFullscreen(settings) && !this.ctx.isDestroyed()) {
      this.ctx.getVideo().setAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR, 'true');
    } else {
      this.ctx.getVideo().removeAttribute(ANIME4K_FULLSCREEN_AUTO_ATTR);
    }
  }

  schedule(delay = FULLSCREEN_RECONCILE_DELAY_MS): void {
    if (this.ctx.isDestroyed()) return;
    const revision = this.ctx.beginReconcile();
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = undefined;
      void this.ctx.enqueue(() => this.reconcile(revision));
    }, delay);
  }

  /** Cancel a pending debounce (stop/detach/reattach/destroy). */
  clearDebounce(): void {
    if (this.debounceTimer) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  get hasPendingReconcile(): boolean {
    return this.debounceTimer !== undefined;
  }

  async reconcile(revision: number): Promise<void> {
    if (this.ctx.isDestroyed() || !this.ctx.isReconcileCurrent(revision)) return;
    // A detached video (stashed across a node swap) must neither start nor
    // stop here: without this guard every timeupdate/scroll during the stash
    // TTL would take the stop branch and tear down the backend the stash
    // preserves. reattach() reschedules a reconcile once the new node is
    // connected.
    if (!this.ctx.getVideo().isConnected) return;
    let settings: Anime4KWebExtSettings;
    try {
      settings = this.ctx.getSettings() ?? await this.ctx.loadSettings();
    } catch (error) {
      console.info('[Anime4K] Could not load settings for fullscreen reconcile:', error instanceof Error ? error.message : String(error));
      return;
    }
    if (this.ctx.isDestroyed() || !this.ctx.isReconcileCurrent(revision)) return;
    this.ctx.setSettings(settings);
    const processingEnabled = isProcessingEnabled(settings.mode, settings.frameGenerationEnabled);
    this.applyMarker(settings);
    const preferredFullscreenVideo = this.isPreferredFullscreenVideo();
    const explicitContext = fullscreenContext.hasContext(this.ctx.getVideo());
    const playerFullscreenSignal = fullscreenContext.hasPlayerSignal(this.ctx.getVideo());
    if (!explicitContext && !playerFullscreenSignal) this.nativeRetryBlocked = false;
    const shouldRun = processingEnabled
      && preferredFullscreenVideo
      && (explicitContext || playerFullscreenSignal)
      && !this.nativeRetryBlocked;

    if (shouldRun) {
      // Refresh the layout on every reconcile so a fullscreen element change
      // re-targets a running session (enter() is a no-op when unchanged).
      if (this.ctx.hasRenderer() || this.ctx.isNativeActive()) this.ctx.enterLayout();
      // A cancellation-marked fallback is still settling but must not block a
      // fresh start the way a live request does (see hasActiveFallback).
      // autoFullscreenEnabled=false keeps manual (popup-started) sessions
      // working but stops the reconcile from auto-starting new ones.
      if (settings.autoFullscreenEnabled
          && !this.ctx.hasRenderer() && !this.ctx.isNativeActive() && !this.ctx.isStarting()
          && !this.ctx.hasActiveFallback()) {
        this.ctx.enterLayout();
        this.automaticSession = true;
        await this.ctx.start(settings);
        if (!this.ctx.hasRenderer() && !this.ctx.isNativeActive()) {
          this.automaticSession = false;
          this.ctx.exitLayout();
        }
      }
      return;
    }

    if (this.automaticSession || this.ctx.hasRenderer() || this.ctx.isNativeActive()
        || this.ctx.isStarting() || this.ctx.hasPendingFallback()) {
      this.automaticSession = false;
      await this.ctx.stop();
    }
  }

  private isPreferredFullscreenVideo(): boolean {
    // The fullscreen context owns the election; the population feeds it the
    // managed, connected videos. This enhancer only asks whether it won.
    return fullscreenContext.preferredVideo() === this.ctx.getVideo();
  }
}
