import { VideoEnhancer } from './video-enhancer';
import { debug } from '../utils/debug-log';

interface StashedEnhancer {
  enhancer: VideoEnhancer;
  mediaKey: string;
  cleanupTimer: number;
}

const stash: StashedEnhancer[] = [];
const STASH_TTL = 2000;

function getMediaKey(video: HTMLVideoElement): string | null {
  const source = video.currentSrc || video.src;
  return source ? `url:${source}` : null;
}

export function stashEnhancer(enhancer: VideoEnhancer): boolean {
  const video = enhancer.getVideoElement();
  const mediaKey = getMediaKey(video);
  if (!mediaKey) return false;

  debug(`Stashing active enhancer for ${mediaKey}.`);
  enhancer.detach();

  const cleanupTimer = window.setTimeout(() => {
    debug(`Stash for ${mediaKey} expired. Cleaning up.`);
    clearStashEntry(mediaKey);
  }, STASH_TTL);

  stash.push({
    enhancer,
    mediaKey,
    cleanupTimer,
  });
  return true;
}

export function findAndUnstashEnhancer(video: HTMLVideoElement): VideoEnhancer | null {
  const mediaKey = getMediaKey(video);
  if (!mediaKey) return null;

  const index = stash.findIndex(item => item.mediaKey === mediaKey);
  if (index === -1) {
    return null;
  }

  const stashedItem = stash[index];
  debug(`Found stashed enhancer for ${mediaKey}. Re-attaching.`);
  clearTimeout(stashedItem.cleanupTimer);
  stash.splice(index, 1);

  return stashedItem.enhancer;
}

function clearStashEntry(mediaKey: string): void {
  const index = stash.findIndex(item => item.mediaKey === mediaKey);
  if (index !== -1) {
    const stashedItem = stash[index];
    clearTimeout(stashedItem.cleanupTimer);
    stashedItem.enhancer.destroy();
    stash.splice(index, 1);
  }
}

export function clearEnhancerStash(): void {
  for (const item of stash.splice(0)) {
    clearTimeout(item.cleanupTimer);
    item.enhancer.destroy();
  }
}
