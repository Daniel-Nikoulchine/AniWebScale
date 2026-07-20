import { describe, expect, it } from 'vitest';
import {
  calculateCapturePopupGeometry,
  calculateVideoCaptureRegion,
  displayScaleFactorForZoom,
  nonClientExtent,
} from '../src/shared/popup-geometry';

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

  it('separates page zoom from OS display scale without scaling monitor bounds', () => {
    expect(displayScaleFactorForZoom(2, 1.25)).toBe(1.6);
    expect(nonClientExtent(1300, 1000, 1.25)).toBe(50);
    const result = calculateCapturePopupGeometry({
      sourceWidth: 1920,
      sourceHeight: 1080,
      displayScaleFactor: 1.6,
      screenAvailLeft: 1920,
      screenAvailTop: 0,
      screenAvailWidth: 1920,
      screenAvailHeight: 1040,
      frameWidth: 16,
      frameHeight: 40,
    });
    expect(result.left).toBeGreaterThanOrEqual(1920);
    expect(result.left + result.width).toBeLessThanOrEqual(3840);
  });

  it('maps intrinsic pixels to physical popup client pixels through DPR', () => {
    const result = calculateCapturePopupGeometry({
      sourceWidth: 1920,
      sourceHeight: 1080,
      displayScaleFactor: 1.5,
      screenAvailLeft: 2560,
      screenAvailTop: 0,
      screenAvailWidth: 2560,
      screenAvailHeight: 1400,
      frameWidth: 16,
      frameHeight: 48,
    });
    expect(result).toMatchObject({ clientWidth: 1280, clientHeight: 720, width: 1296, height: 768 });
    expect(result.left).toBe(3192);
    expect(result.top).toBe(316);
    expect(result.scale).toBe(1);
  });

  it('fits oversized sources to the usable monitor while preserving aspect ratio', () => {
    const result = calculateCapturePopupGeometry({
      sourceWidth: 3840,
      sourceHeight: 2160,
      displayScaleFactor: 1,
      screenAvailLeft: -1920,
      screenAvailTop: 0,
      screenAvailWidth: 1920,
      screenAvailHeight: 1040,
      frameWidth: 16,
      frameHeight: 40,
    });
    expect(result.width).toBeLessThanOrEqual(1920);
    expect(result.height).toBeLessThanOrEqual(1040);
    expect(result.left).toBeGreaterThanOrEqual(-1920);
    expect(result.clientWidth / result.clientHeight).toBeCloseTo(16 / 9, 2);
    expect(result.scale).toBeLessThan(1);
  });
});
