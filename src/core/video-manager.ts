import { ANIME4K_APPLIED_ATTR } from '../constants';
import type { Anime4KWebExtSettings } from '../types';
import { getSettings } from '../utils/settings';
import * as EnhancerMap from './enhancer-map';
import {
  clearEnhancerStash,
  findAndUnstashEnhancer,
  stashEnhancer,
} from './enhancer-stash';
import { VideoEnhancer } from './video-enhancer';

const mediaEventsToWatch = ['loadedmetadata', 'play', 'playing'] as const;
const observedRoots = new Map<Document | ShadowRoot, MutationObserver>();
let initialized = false;
let initializationRevision = 0;

function cleanupVideoEnhancer(video: HTMLVideoElement, allowStash = true): void {
  const enhancer = EnhancerMap.getEnhancer(video);
  if (!enhancer) return;

  const stashed = allowStash
    && video.hasAttribute(ANIME4K_APPLIED_ATTR)
    && stashEnhancer(enhancer);
  if (!stashed) enhancer.destroy();
  EnhancerMap.dissociateEnhancer(video);
}

export function processVideoElement(video: HTMLVideoElement, source: string): void {
  if (EnhancerMap.hasEnhancer(video) || !video.isConnected) return;

  const stashedEnhancer = findAndUnstashEnhancer(video);
  if (stashedEnhancer) {
    EnhancerMap.associateEnhancer(video, stashedEnhancer);
    void stashedEnhancer.reattach(video).catch(error => {
      console.error('[Anime4K] Failed to reattach a replaced video element.', error);
      EnhancerMap.dissociateEnhancer(video);
      stashedEnhancer.destroy();
    });
    return;
  }

  try {
    EnhancerMap.associateEnhancer(video, VideoEnhancer.create(video));
  } catch (error) {
    console.error(`[Anime4K] Failed to manage a video discovered by ${source}.`, error);
  }
}

function handleMediaEvent(event: Event): void {
  if (event.target instanceof HTMLVideoElement) {
    processVideoElement(event.target, `media-event:${event.type}`);
  }
}

function removeRootObservation(root: Document | ShadowRoot): void {
  const observer = observedRoots.get(root);
  if (!observer) return;
  observer.disconnect();
  for (const eventName of mediaEventsToWatch) {
    root.removeEventListener(eventName, handleMediaEvent, { capture: true });
  }
  observedRoots.delete(root);
}

function cleanupShadowRoot(root: ShadowRoot, allowStash: boolean): void {
  root.querySelectorAll('*').forEach(element => {
    if (element instanceof HTMLVideoElement) cleanupVideoEnhancer(element, allowStash);
    if (element.shadowRoot) cleanupShadowRoot(element.shadowRoot, allowStash);
  });
  removeRootObservation(root);
}

function cleanupElementTree(element: Element, allowStash: boolean): void {
  if (element instanceof HTMLVideoElement) cleanupVideoEnhancer(element, allowStash);
  if (element.shadowRoot) cleanupShadowRoot(element.shadowRoot, allowStash);
  element.querySelectorAll('*').forEach(descendant => {
    if (descendant instanceof HTMLVideoElement) cleanupVideoEnhancer(descendant, allowStash);
    if (descendant.shadowRoot) cleanupShadowRoot(descendant.shadowRoot, allowStash);
  });
}

function scanRoot(root: Document | ShadowRoot, source: string): void {
  root.querySelectorAll('*').forEach(element => {
    if (element instanceof HTMLVideoElement) processVideoElement(element, source);
    if (element.shadowRoot) observeRoot(element.shadowRoot, `${source}:shadow-root`);
  });
}

function scanAddedElement(element: Element): void {
  if (element instanceof HTMLVideoElement) {
    processVideoElement(element, 'mutation:video');
  }
  if (element.shadowRoot) observeRoot(element.shadowRoot, 'mutation:shadow-root');
  element.querySelectorAll('*').forEach(descendant => {
    if (descendant instanceof HTMLVideoElement) processVideoElement(descendant, 'mutation:subtree');
    if (descendant.shadowRoot) observeRoot(descendant.shadowRoot, 'mutation:nested-shadow-root');
  });
}

function observeRoot(root: Document | ShadowRoot, source: string): MutationObserver {
  const existing = observedRoots.get(root);
  if (existing) return existing;

  for (const eventName of mediaEventsToWatch) {
    root.addEventListener(eventName, handleMediaEvent, { capture: true, passive: true });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) scanAddedElement(node);
      });
      mutation.removedNodes.forEach(node => {
        if (node instanceof Element) cleanupElementTree(node, true);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  observedRoots.set(root, observer);
  scanRoot(root, source);
  return observer;
}

function destroyAllEnhancers(): void {
  for (const video of EnhancerMap.getAllManagedVideos()) {
    const enhancer = EnhancerMap.getEnhancer(video);
    enhancer?.destroy();
    EnhancerMap.dissociateEnhancer(video);
  }
  clearEnhancerStash();
}

function handlePageUnload(): void {
  initializationRevision += 1;
  for (const root of Array.from(observedRoots.keys())) removeRootObservation(root);
  destroyAllEnhancers();
  initialized = false;
}

export async function initializeOnPage(): Promise<void> {
  if (initialized) return;
  const revision = initializationRevision;
  const settings = await getSettings();
  if (revision !== initializationRevision || !settings.extensionEnabled || initialized) return;
  initialized = true;
  observeRoot(document, 'initial-scan');
  window.addEventListener('beforeunload', handlePageUnload, { once: true });
}

export function setupDOMObserver(): MutationObserver {
  return observeRoot(document, 'manual-initial-scan');
}

export async function handleSettingsUpdate(
  message: { type: string; modifiedModeId?: string },
  sendResponse: (response?: { status: string; message: string }) => void,
): Promise<void> {
  const newSettings: Anime4KWebExtSettings = await getSettings();
  initializationRevision += 1;

  if (!newSettings.extensionEnabled) {
    const managedCount = EnhancerMap.getAllManagedVideos().length;
    deinitializeOnPage();
    sendResponse(managedCount > 0
      ? { status: 'SUCCESS', message: `Disabled Anime4K on ${managedCount} managed video(s).` }
      : { status: 'NO_ACTION', message: 'AniWebScale is disabled.' });
    return;
  }

  if (!initialized) {
    await initializeOnPage();
    sendResponse({ status: 'SUCCESS', message: 'Anime4K is enabled.' });
    return;
  }

  let updatedCount = 0;
  let updateError: Error | null = null;

  for (const video of EnhancerMap.getAllManagedVideos()) {
    const enhancer = EnhancerMap.getEnhancer(video);
    if (!enhancer) continue;
    const isActive = video.getAttribute(ANIME4K_APPLIED_ATTR) === 'true';
    if (message.modifiedModeId && isActive && enhancer.getCurrentModeId() !== message.modifiedModeId) continue;

    try {
      await enhancer.updateSettings(newSettings);
      if (isActive) updatedCount += 1;
    } catch (error) {
      console.error('[Anime4K] Failed to apply updated settings.', error);
      updateError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (updateError) {
    sendResponse({ status: 'ERROR', message: updateError.message });
  } else if (updatedCount > 0) {
    sendResponse({ status: 'SUCCESS', message: `Updated ${updatedCount} active video(s).` });
  } else {
    sendResponse({ status: 'NO_ACTION', message: 'No active instance needed an update.' });
  }
}

export function deinitializeOnPage(): void {
  window.removeEventListener('beforeunload', handlePageUnload);
  handlePageUnload();
}
