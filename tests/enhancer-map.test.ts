import { beforeEach, describe, expect, it } from 'vitest';
import {
  associateEnhancer,
  dissociateEnhancer,
  getAllManagedVideos,
  getEnhancer,
  hasEnhancer,
} from '../src/core/enhancer-map';
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
