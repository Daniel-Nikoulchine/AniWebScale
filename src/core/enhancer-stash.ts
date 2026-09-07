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

  const item: StashedEnhancer = {
    enhancer,
    mediaKey,
    cleanupTimer: 0,
  };
  // Expire this exact stash item, not "whichever entry currently holds the
  // key": two players sharing one source URL would otherwise let the first
  // expiry kill the second (newer) entry.
  item.cleanupTimer = window.setTimeout(() => {
    debug(`Stash for ${mediaKey} expired. Cleaning up.`);
    const index = stash.indexOf(item);
    if (index !== -1) {
      const [stashed] = stash.splice(index, 1);
      stashed.enhancer.destroy();
    }
  }, STASH_TTL);

  stash.push(item);
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

export function clearEnhancerStash(): void {
  for (const item of stash.splice(0)) {
    clearTimeout(item.cleanupTimer);
    item.enhancer.destroy();
  }
}
