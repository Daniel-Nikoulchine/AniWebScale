import { describe, expect, it } from 'vitest';
import { calculateVideoCaptureRegion } from '../src/shared/popup-geometry';

describe('native capture popup geometry', () => {
  it('converts and clips the player rectangle to physical client pixels', () => {
    expect(calculateVideoCaptureRegion({
      left: 100,
      top: -10,
      width: 900,
      height: 520,
      viewportWidth: 960,
      viewportHeight: 540,
      devicePixelRatio: 1.5,
    })).toEqual({ x: 150, y: 0, width: 1290, height: 765 });
  });

  it('omits invalid or tiny player crop rectangles', () => {
    expect(calculateVideoCaptureRegion({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      viewportWidth: 1920,
      viewportHeight: 1080,
      devicePixelRatio: 1,
    })).toBeUndefined();
  });
});
