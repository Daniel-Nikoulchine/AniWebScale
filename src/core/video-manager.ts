import { ANIME4K_APPLIED_ATTR } from '../constants';
import type { Anime4KWebExtSettings } from '../types';
import { getSettings } from '../utils/settings';
import {
  associateEnhancer,
  clearEnhancerStash,
  dissociateEnhancer,
  findAndUnstashEnhancer,
  getAllManagedVideos,
  getEnhancer,
  hasEnhancer,
  stashEnhancer,
} from './video-population';
import { VideoEnhancer } from './video-enhancer';
import { walkElementTree, walkTree } from './dom-tree-walker';

const mediaEventsToWatch = ['loadedmetadata', 'play', 'playing', 'canplay'] as const;

function isVideoElement(element: EventTarget | Element | null): element is HTMLVideoElement {
  return typeof HTMLVideoElement !== 'undefined' && element instanceof HTMLVideoElement;
}

class VideoDiscovery {
  private readonly observedRoots = new Map<Document | ShadowRoot, MutationObserver>();
  private initialized = false;
  private initializationRevision = 0;
  private initializationPromise: Promise<void> | null = null;
  private lateScanTimer: number | undefined;
  private hosterObserver: MutationObserver | undefined;

  private readonly handleMediaEvent = (event: Event): void => {
    if (isVideoElement(event.target)) {
      this.processVideoElement(event.target, `media-event:${event.type}`);
    }
  };

  private readonly scanForLatePlayer = (): void => {
    if (!this.initialized) return;
    this.scanRoot(document, 'late-player-scan');
    this.lateScanTimer = window.setTimeout(this.scanForLatePlayer, 1500);
  };

  private readonly handlePageHide = (event: PageTransitionEvent): void => {
    // A persisted pagehide only freezes the document for the back/forward
    // cache; its enhancers must survive so playback resumes enhanced after the
    // user navigates back. Teardown also must not run when a beforeunload
    // dialog is cancelled, so it runs on the real unload path only.
    if (event.persisted) return;
    window.removeEventListener('pagehide', this.handlePageHide);
    this.handlePageUnload();
  };

  private cleanupVideoEnhancer(video: HTMLVideoElement, allowStash = true): void {
    const enhancer = getEnhancer(video);
    if (!enhancer) return;

    const stashed = allowStash
      && video.hasAttribute(ANIME4K_APPLIED_ATTR)
      && stashEnhancer(enhancer);
    // Dissociate even when teardown throws: a dead map entry would keep
    // serving the zombie to election and the test bridge.
    try {
      if (!stashed) enhancer.destroy();
    } finally {
      dissociateEnhancer(video);
    }
  }

  private processVideoElement(video: HTMLVideoElement, source: string): void {
    if (hasEnhancer(video) || !video.isConnected) return;

    const stashedEnhancer = findAndUnstashEnhancer(video);
    if (stashedEnhancer) {
      associateEnhancer(video, stashedEnhancer);
      void stashedEnhancer.reattach(video).then(() => {
        // The node may have been removed again while the async renderer
        // source switch was in flight; don't keep an enhancer mapped to a
        // disconnected video (election, observers and stats would go stale).
        if (!video.isConnected) {
          dissociateEnhancer(video);
          stashedEnhancer.destroy();
        }
      }).catch(error => {
        console.error('[Anime4K] Failed to reattach a replaced video element.', error);
        dissociateEnhancer(video);
        stashedEnhancer.destroy();
      });
      return;
    }

    try {
      associateEnhancer(video, VideoEnhancer.create(video));
    } catch (error) {
      console.error(`[Anime4K] Failed to manage a video discovered by ${source}.`, error);
    }
  }

  private installHosterSurfaceObserver(): void {
    if (this.hosterObserver || typeof MutationObserver === 'undefined') return;
    this.hosterObserver = new MutationObserver(() => {
      this.scanRoot(document, 'hoster-surface-update');
    });
    this.hosterObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'class'],
    });
  }

  private removeRootObservation(root: Document | ShadowRoot): void {
    const observer = this.observedRoots.get(root);
    if (!observer) return;
    observer.disconnect();
    for (const eventName of mediaEventsToWatch) {
      root.removeEventListener(eventName, this.handleMediaEvent, { capture: true });
    }
    this.observedRoots.delete(root);
  }

  private cleanupElementTree(element: Element, allowStash: boolean): void {
    walkElementTree(element, current => {
      if (isVideoElement(current)) this.cleanupVideoEnhancer(current, allowStash);
      if (current.shadowRoot) this.removeRootObservation(current.shadowRoot);
    });
  }

  private scanRoot(root: Document | ShadowRoot, source: string): void {
    walkTree(root, element => {
      if (isVideoElement(element)) this.processVideoElement(element, source);
      if (element.shadowRoot) this.observeRoot(element.shadowRoot, `${source}:shadow-root`);
    });
  }

  private scanAddedElement(element: Element): void {
    walkElementTree(element, current => {
      if (isVideoElement(current)) this.processVideoElement(current, 'mutation:subtree');
      if (current.shadowRoot) this.observeRoot(current.shadowRoot, 'mutation:shadow-root');
    });
  }

  private observeRoot(root: Document | ShadowRoot, source: string): MutationObserver {
    const existing = this.observedRoots.get(root);
    if (existing) return existing;

    for (const eventName of mediaEventsToWatch) {
      root.addEventListener(eventName, this.handleMediaEvent, { capture: true, passive: true });
    }

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) this.scanAddedElement(node);
        });
        mutation.removedNodes.forEach(node => {
          if (node instanceof Element) this.cleanupElementTree(node, true);
        });
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    this.observedRoots.set(root, observer);
    this.scanRoot(root, source);
    return observer;
  }

  private destroyAllEnhancers(): void {
    for (const video of getAllManagedVideos()) {
      const enhancer = getEnhancer(video);
      enhancer?.destroy();
      dissociateEnhancer(video);
    }
    clearEnhancerStash();
  }

  private handlePageUnload(): void {
    this.initializationRevision += 1;
    this.initializationPromise = null;
    if (this.lateScanTimer !== undefined) {
      window.clearTimeout(this.lateScanTimer);
      this.lateScanTimer = undefined;
    }
    this.hosterObserver?.disconnect();
    this.hosterObserver = undefined;
    for (const root of Array.from(this.observedRoots.keys())) this.removeRootObservation(root);
    this.destroyAllEnhancers();
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.initializationPromise) {
      return this.initializationPromise ?? Promise.resolve();
    }

    const revision = this.initializationRevision;
    const operation = (async () => {
      const settings = await getSettings();
      if (revision !== this.initializationRevision || !settings.extensionEnabled || this.initialized) return;
      this.initialized = true;
      this.observeRoot(document, 'initial-scan');
      this.installHosterSurfaceObserver();
      this.lateScanTimer = window.setTimeout(this.scanForLatePlayer, 250);
      window.addEventListener('pagehide', this.handlePageHide);
    })();
    this.initializationPromise = operation;
    void operation.finally(() => {
      if (this.initializationPromise === operation) this.initializationPromise = null;
    }).catch(() => undefined);
    return operation;
  }

  deinitialize(): void {
    window.removeEventListener('pagehide', this.handlePageHide);
    this.handlePageUnload();
  }

  getManagedVideos(): HTMLVideoElement[] {
    return getAllManagedVideos();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

const discovery = new VideoDiscovery();

/**
 * Initialize the page's video discovery. Never rejects by contract: a
 * failure (e.g. storage hiccup in getSettings) logs and resolves, and the
 * next scan/pageshow retries initialization. Call sites are fire-and-forget.
 */
export function initializeOnPage(): Promise<void> {
  // Fire-and-forget at both call sites: a rejection (e.g. storage hiccup
  // in getSettings) must not surface as an unhandled rejection, and the
  // next scan/pageshow retries initialization anyway.
  return discovery.initialize().catch((error: unknown) => {
    console.info('[AniWebScale] Page initialization failed; will retry on the next scan.', error);
  });
}

export type SettingsReapplyResult = { status: 'SUCCESS' | 'NO_ACTION' | 'ERROR'; message: string };

/**
 * Re-apply the persisted settings to this page: initialize or tear down the
 * enhancer population as needed and push the new settings to every managed
 * enhancer. The content entry calls this whenever storage.onChanged fires;
 * the summary is a return value, not a message response.
 */
export async function reapplySettings(): Promise<SettingsReapplyResult> {
  const newSettings: Anime4KWebExtSettings = await getSettings();
  if (!newSettings.extensionEnabled) {
    const managedCount = discovery.getManagedVideos().length;
    discovery.deinitialize();
    return managedCount > 0
      ? { status: 'SUCCESS', message: `Disabled Anime4K on ${managedCount} managed video(s).` }
      : { status: 'NO_ACTION', message: 'AniWebScale is disabled.' };
  }

  if (!discovery.isInitialized()) {
    await discovery.initialize();
    return { status: 'SUCCESS', message: 'Anime4K is enabled.' };
  }

  let updatedCount = 0;
  let updateError: Error | null = null;

  for (const video of discovery.getManagedVideos()) {
    const enhancer = getEnhancer(video);
    if (!enhancer) continue;
    const isActive = enhancer.isActive();

    try {
      await enhancer.updateSettings(newSettings);
      if (isActive) updatedCount += 1;
    } catch (error) {
      console.error('[Anime4K] Failed to apply updated settings.', error);
      updateError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (updateError) {
    return { status: 'ERROR', message: updateError.message };
  }
  if (updatedCount > 0) {
    return { status: 'SUCCESS', message: `Updated ${updatedCount} active video(s).` };
  }
  return { status: 'NO_ACTION', message: 'No active instance needed an update.' };
}
