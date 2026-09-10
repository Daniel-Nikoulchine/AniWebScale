import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  associateEnhancer,
  clearEnhancerStash,
  dissociateEnhancer,
  findAndUnstashEnhancer,
  getAllManagedVideos,
  getEnhancer,
  hasEnhancer,
  stashEnhancer,
} from '../src/core/video-population';
import type { VideoEnhancer } from '../src/core/video-enhancer';

// The map is keyed by the video element identity, so plain objects work as
// stand-ins for HTMLVideoElement in a node environment.
function fakeVideo(id: string): HTMLVideoElement {
  return { dataset: { id } } as unknown as HTMLVideoElement;
}

function fakeEnhancer(id: string): VideoEnhancer {
  return { id } as unknown as VideoEnhancer;
}

describe('enhancer-map', () => {
  beforeEach(() => {
    // Reset the module-level map between tests.
    for (const video of getAllManagedVideos()) dissociateEnhancer(video);
  });

  it('associates and retrieves an enhancer by video identity', () => {
    const video = fakeVideo('a');
    const enhancer = fakeEnhancer('enh-a');
    associateEnhancer(video, enhancer);
    expect(getEnhancer(video)).toBe(enhancer);
    expect(hasEnhancer(video)).toBe(true);
  });

  it('returns undefined for an unassociated video', () => {
    expect(getEnhancer(fakeVideo('missing'))).toBeUndefined();
    expect(hasEnhancer(fakeVideo('missing'))).toBe(false);
  });

  it('keeps distinct videos mapped to distinct enhancers', () => {
    const videoA = fakeVideo('a');
    const videoB = fakeVideo('b');
    const enhancerA = fakeEnhancer('enh-a');
    const enhancerB = fakeEnhancer('enh-b');
    associateEnhancer(videoA, enhancerA);
    associateEnhancer(videoB, enhancerB);
    expect(getEnhancer(videoA)).toBe(enhancerA);
    expect(getEnhancer(videoB)).toBe(enhancerB);
    expect(getAllManagedVideos()).toHaveLength(2);
  });

  it('overwrites the enhancer when a video is re-associated', () => {
    const video = fakeVideo('a');
    associateEnhancer(video, fakeEnhancer('first'));
    const second = fakeEnhancer('second');
    associateEnhancer(video, second);
    expect(getEnhancer(video)).toBe(second);
    expect(getAllManagedVideos()).toHaveLength(1);
  });

  it('dissociates a video and reports it as unmanaged afterwards', () => {
    const video = fakeVideo('a');
    associateEnhancer(video, fakeEnhancer('enh-a'));
    dissociateEnhancer(video);
    expect(hasEnhancer(video)).toBe(false);
    expect(getAllManagedVideos()).toHaveLength(0);
  });

  it('treats dissociating an unknown video as a no-op', () => {
    expect(() => dissociateEnhancer(fakeVideo('ghost'))).not.toThrow();
  });
});

interface FakeStashedEnhancer {
  enhancer: VideoEnhancer;
  detach: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  getVideoElement: ReturnType<typeof vi.fn>;
}

function fakeStashedEnhancer(src: string): FakeStashedEnhancer {
  const video = { currentSrc: src, src } as unknown as HTMLVideoElement;
  const detach = vi.fn();
  const destroy = vi.fn();
  const getVideoElement = vi.fn(() => video);
  const enhancer = { detach, destroy, getVideoElement } as unknown as VideoEnhancer;
  return { enhancer, detach, destroy, getVideoElement };
}

describe('enhancer-stash', () => {
  beforeEach(() => {
    // The module uses window.setTimeout / window.clearTimeout; expose the
    // node timer functions under a window stub so fake timers can drive them.
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
      clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
    });
  });

  afterEach(() => {
    clearEnhancerStash();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stashes an enhancer, detaching it from its video', () => {
    const { enhancer, detach } = fakeStashedEnhancer('https://cdn/video.mp4');
    expect(stashEnhancer(enhancer)).toBe(true);
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it('refuses to stash an enhancer whose video has no source', () => {
    const { enhancer, detach } = fakeStashedEnhancer('');
    expect(stashEnhancer(enhancer)).toBe(false);
    expect(detach).not.toHaveBeenCalled();
  });

  it('returns the same enhancer instance when unstashing by matching source', () => {
    const { enhancer } = fakeStashedEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBe(enhancer);
  });

  it('returns null when no stashed enhancer matches the video source', () => {
    const { enhancer } = fakeStashedEnhancer('https://cdn/a.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/other.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBeNull();
  });

  it('removes an enhancer from the stash once it has been unstashed', () => {
    const { enhancer } = fakeStashedEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBe(enhancer);
    expect(findAndUnstashEnhancer(lookup)).toBeNull();
  });

  it('destroys a stashed enhancer when its TTL expires', () => {
    const { enhancer, destroy } = fakeStashedEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    vi.advanceTimersByTime(2000);
    expect(destroy).toHaveBeenCalledTimes(1);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBeNull();
  });

  it('cancels the TTL cleanup when the enhancer is unstashed in time', () => {
    const { enhancer, destroy } = fakeStashedEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    findAndUnstashEnhancer(lookup);
    vi.advanceTimersByTime(5000);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('clearEnhancerStash destroys every pending enhancer', () => {
    const a = fakeStashedEnhancer('https://cdn/a.mp4');
    const b = fakeStashedEnhancer('https://cdn/b.mp4');
    stashEnhancer(a.enhancer);
    stashEnhancer(b.enhancer);
    clearEnhancerStash();
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
  });
});
