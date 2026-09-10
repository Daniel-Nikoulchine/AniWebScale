import { VideoEnhancer } from './video-enhancer';
import { fullscreenContext } from './fullscreen-context';
import { debug } from '../utils/debug-log';

// 使用 Map 来存储 video 元素和其对应的 enhancer 实例
const enhancerMap = new Map<HTMLVideoElement, VideoEnhancer>();

/**
 * 将一个 enhancer 实例与一个 video 元素关联起来
 * @param video HTMLVideoElement - 键
 * @param enhancer VideoEnhancer - 值
 */
export function associateEnhancer(video: HTMLVideoElement, enhancer: VideoEnhancer): void {
  enhancerMap.set(video, enhancer);
}

/**
 * 根据 video 元素获取其关联的 enhancer 实例
 * @param video HTMLVideoElement - 键
 * @returns VideoEnhancer | undefined
 */
export function getEnhancer(video: HTMLVideoElement): VideoEnhancer | undefined {
  return enhancerMap.get(video);
}

/**
 * 检查一个 video 元素是否已经有关联的 enhancer
 * @param video HTMLVideoElement - 键
 * @returns boolean
 */
export function hasEnhancer(video: HTMLVideoElement): boolean {
  return enhancerMap.has(video);
}

/**
 * 解除 video 元素与其 enhancer 实例的关联
 * @param video HTMLVideoElement - 键
 */
export function dissociateEnhancer(video: HTMLVideoElement): void {
  enhancerMap.delete(video);
}

/**
 * 获取所有被管理的 video 元素
 * @returns HTMLVideoElement[]
 */
export function getAllManagedVideos(): HTMLVideoElement[] {
  return Array.from(enhancerMap.keys());
}

/**
 * The page's live enhancers: the single owner of "all enhancers for this
 * page". A destroyed enhancer whose map entry has not been cleared yet is
 * filtered out, and each enhancer appears at most once. Fullscreen election
 * consumes this (through the fullscreen context) instead of a second registry.
 */
export function getManagedEnhancers(): VideoEnhancer[] {
  const enhancers = new Set<VideoEnhancer>();
  for (const enhancer of enhancerMap.values()) {
    if (!enhancer.isDestroyed && enhancer.getVideoElement().isConnected) {
      enhancers.add(enhancer);
    }
  }
  return Array.from(enhancers);
}

// The fullscreen decision owner reads its candidates from the population:
// this is the one place that knows the managed video set, so the election
// cannot drift from it.
fullscreenContext.setCandidateSource(() =>
  getManagedEnhancers().map(enhancer => ({
    video: enhancer.getVideoElement(),
    videoId: enhancer.getVideoId(),
  })),
);

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
