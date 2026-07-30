import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEnhancerStash,
  findAndUnstashEnhancer,
  stashEnhancer,
} from '../src/core/enhancer-stash';
import type { VideoEnhancer } from '../src/core/video-enhancer';

interface FakeEnhancer {
  enhancer: VideoEnhancer;
  detach: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  getVideoElement: ReturnType<typeof vi.fn>;
}

function fakeEnhancer(src: string): FakeEnhancer {
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
    const { enhancer, detach } = fakeEnhancer('https://cdn/video.mp4');
    expect(stashEnhancer(enhancer)).toBe(true);
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it('refuses to stash an enhancer whose video has no source', () => {
    const { enhancer, detach } = fakeEnhancer('');
    expect(stashEnhancer(enhancer)).toBe(false);
    expect(detach).not.toHaveBeenCalled();
  });

  it('returns the same enhancer instance when unstashing by matching source', () => {
    const { enhancer } = fakeEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBe(enhancer);
  });

  it('returns null when no stashed enhancer matches the video source', () => {
    const { enhancer } = fakeEnhancer('https://cdn/a.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/other.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBeNull();
  });

  it('removes an enhancer from the stash once it has been unstashed', () => {
    const { enhancer } = fakeEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBe(enhancer);
    expect(findAndUnstashEnhancer(lookup)).toBeNull();
  });

  it('destroys a stashed enhancer when its TTL expires', () => {
    const { enhancer, destroy } = fakeEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    vi.advanceTimersByTime(2000);
    expect(destroy).toHaveBeenCalledTimes(1);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    expect(findAndUnstashEnhancer(lookup)).toBeNull();
  });

  it('cancels the TTL cleanup when the enhancer is unstashed in time', () => {
    const { enhancer, destroy } = fakeEnhancer('https://cdn/video.mp4');
    stashEnhancer(enhancer);
    const lookup = { currentSrc: 'https://cdn/video.mp4', src: '' } as unknown as HTMLVideoElement;
    findAndUnstashEnhancer(lookup);
    vi.advanceTimersByTime(5000);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('clearEnhancerStash destroys every pending enhancer', () => {
    const a = fakeEnhancer('https://cdn/a.mp4');
    const b = fakeEnhancer('https://cdn/b.mp4');
    stashEnhancer(a.enhancer);
    stashEnhancer(b.enhancer);
    clearEnhancerStash();
    expect(a.destroy).toHaveBeenCalledTimes(1);
    expect(b.destroy).toHaveBeenCalledTimes(1);
  });
});
