import { describe, expect, it } from 'vitest';
import { calculateRenderedVideoRect } from '../src/shared/video-content-rect';

describe('rendered video geometry', () => {
  it('removes contain letterboxing and honors object position', () => {
    expect(calculateRenderedVideoRect({
      left: 0, top: 0, width: 1920, height: 1080,
      videoWidth: 640, videoHeight: 480,
      objectFit: 'contain', objectPosition: '50% 50%',
    })).toEqual({ left: 240, top: 0, width: 1440, height: 1080 });
  });

  it('uses the full element for cover because overflow is already clipped', () => {
    expect(calculateRenderedVideoRect({
      left: 10, top: 20, width: 1000, height: 500,
      videoWidth: 640, videoHeight: 480, objectFit: 'cover',
    })).toEqual({ left: 10, top: 20, width: 1000, height: 500 });
  });

  it('accepts vertical-first object-position keywords', () => {
    expect(calculateRenderedVideoRect({
      left: 0, top: 0, width: 1920, height: 1080,
      videoWidth: 640, videoHeight: 480,
      objectFit: 'contain', objectPosition: 'top right',
    })).toEqual({ left: 480, top: 0, width: 1440, height: 1080 });
  });

  it('centers the omitted horizontal component of a single vertical keyword', () => {
    expect(calculateRenderedVideoRect({
      left: 0, top: 0, width: 1920, height: 1080,
      videoWidth: 640, videoHeight: 480,
      objectFit: 'contain', objectPosition: 'top',
    })).toEqual({ left: 240, top: 0, width: 1440, height: 1080 });
  });

  it('clips an unscaled video to its element after applying object position', () => {
    expect(calculateRenderedVideoRect({
      left: 100, top: 50, width: 320, height: 180,
      videoWidth: 640, videoHeight: 480,
      objectFit: 'none', objectPosition: 'left top',
    })).toEqual({ left: 100, top: 50, width: 320, height: 180 });
  });

  it('supports edge-offset three- and four-value object positions', () => {
    const input = {
      left: 0, top: 0, width: 300, height: 200,
      videoWidth: 100, videoHeight: 50, objectFit: 'none',
    };
    expect(calculateRenderedVideoRect({
      ...input,
      objectPosition: 'right 20px bottom 10px',
    })).toEqual({ left: 180, top: 140, width: 100, height: 50 });
    expect(calculateRenderedVideoRect({
      ...input,
      objectPosition: 'right 20px bottom',
    })).toEqual({ left: 180, top: 150, width: 100, height: 50 });
  });

  it('evaluates computed calc positions without splitting their whitespace', () => {
    expect(calculateRenderedVideoRect({
      left: 0, top: 0, width: 300, height: 200,
      videoWidth: 100, videoHeight: 50, objectFit: 'none',
      objectPosition: 'calc(100% - 20px) calc(100% - 10px)',
    })).toEqual({ left: 180, top: 140, width: 100, height: 50 });
  });
});
