import { describe, expect, it } from 'vitest';
import { calculateIntrinsicCaptureStage } from '../src/shared/intrinsic-capture';

describe('intrinsic native capture staging', () => {
  it('centers a decoded 720p frame without browser-side upscaling', () => {
    expect(calculateIntrinsicCaptureStage({
      intrinsicWidth: 1280,
      intrinsicHeight: 720,
      viewportWidth: 2048,
      viewportHeight: 1152,
      devicePixelRatio: 1,
    })).toEqual({
      left: 384,
      top: 216,
      width: 1280,
      height: 720,
      sourceWidth: 1280,
      sourceHeight: 720,
      targetWidth: 2048,
      targetHeight: 1152,
    });
  });

  it('converts physical decoded pixels to CSS pixels at display scale', () => {
    expect(calculateIntrinsicCaptureStage({
      intrinsicWidth: 1920,
      intrinsicHeight: 1080,
      viewportWidth: 1536,
      viewportHeight: 864,
      devicePixelRatio: 1.25,
    })).toMatchObject({
      left: 0,
      top: 0,
      width: 1536,
      height: 864,
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 1920,
      targetHeight: 1080,
    });
  });

  it('fits video larger than the output without enlarging the capture surface', () => {
    expect(calculateIntrinsicCaptureStage({
      intrinsicWidth: 3840,
      intrinsicHeight: 2160,
      viewportWidth: 1920,
      viewportHeight: 1080,
      devicePixelRatio: 1,
    })).toMatchObject({
      width: 1920,
      height: 1080,
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 1920,
      targetHeight: 1080,
    });
  });
});
