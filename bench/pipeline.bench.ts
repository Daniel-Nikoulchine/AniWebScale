import './setup-worker-stub';
import { bench, describe } from 'vitest';
import {
  detectContentRectRgba,
  detectContentRectPlanar,
  verifyCropHoldsRgba,
  verifyCropHoldsPlanar,
  cropRgbaRect,
  cropPlanarRect,
  snapCropToTargetGrid,
  fullContentRect,
  type ContentRect,
} from '../src/shared/realesrgan-letterbox';
import { hashFrameBytes } from '../src/shared/realesrgan-stillframe';
import { copyMappedRange, planReadback, unpackReadback, unpackReadbackToPlanarRgb } from '../src/shared/realesrgan-readback';

function makeLetterboxedRgba(w: number, h: number, bar: number): Uint8Array {
  const a = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      const isBar = y < bar || y >= h - bar;
      const v = isBar ? 0 : ((x * 7 + y * 13) & 0xff);
      a[o] = v;
      a[o + 1] = v;
      a[o + 2] = v;
      a[o + 3] = 255;
    }
  }
  return a;
}

function makeLetterboxedPlanar(w: number, h: number, bar: number): Float32Array {
  const pixels = w * h;
  const a = new Float32Array(3 * pixels);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      const isBar = y < bar || y >= h - bar;
      const v = isBar ? 0 : (((x * 7 + y * 13) & 0xff) / 255);
      a[p] = v;
      a[pixels + p] = v;
      a[2 * pixels + p] = v;
    }
  }
  return a;
}

const W = 640;
const H = 360;
const BAR = 60;
const rgba = makeLetterboxedRgba(W, H, BAR);
const planar = makeLetterboxedPlanar(W, H, BAR);
const contentRect: ContentRect = { x: 0, y: BAR, width: W, height: H - 2 * BAR };
const fullRect = fullContentRect(W, H);

const cropRgbaOut = new Uint8Array(contentRect.width * contentRect.height * 4);
const cropPlanarOut = new Float32Array(3 * contentRect.width * contentRect.height);

const plan = planReadback(W, H, 'rgba8unorm');
const mapped = new ArrayBuffer(plan.byteLength);
const mappedOut = new Uint8Array(plan.byteLength);

describe('letterbox detection (cadence: every 30 frames)', () => {
  bench('detectContentRectRgba 640x360 with bars', () => {
    detectContentRectRgba(rgba, W, H);
  });
  bench('detectContentRectPlanar 640x360 with bars', () => {
    detectContentRectPlanar(planar, W, H);
  });
});

describe('letterbox verify (every processed frame, bar area only)', () => {
  bench('verifyCropHoldsRgba 640x360 60px bars', () => {
    verifyCropHoldsRgba(rgba, W, H, contentRect);
  });
  bench('verifyCropHoldsPlanar 640x360 60px bars', () => {
    verifyCropHoldsPlanar(planar, W, H, contentRect);
  });
  bench('verifyCropHoldsRgba full frame (no-op scan)', () => {
    verifyCropHoldsRgba(rgba, W, H, fullRect);
  });
});

describe('crop slice (only when a crop is active)', () => {
  bench('cropRgbaRect 640x360 -> 640x240', () => {
    cropRgbaRect(rgba, W, H, contentRect, cropRgbaOut);
  });
  bench('cropPlanarRect 640x360 -> 640x240', () => {
    cropPlanarRect(planar, W, H, contentRect, cropPlanarOut);
  });
  bench('snapCropToTargetGrid 853x480 -> 1280', () => {
    snapCropToTargetGrid({ x: 12, y: 60, width: 829, height: 360 }, 853, 480, 1280, 720);
  });
});

describe('still-frame hash (every processed frame)', () => {
  bench('hashFrameBytes 640x360 rgba (1.6MB, stride 16)', () => {
    hashFrameBytes(rgba);
  });
});

describe('readback mapped-range copy (every processed frame)', () => {
  bench('copyMappedRange 640x360 rgba8', () => {
    copyMappedRange(mapped, mappedOut);
  });
});

describe('f16 readback unpack (10/12-bit sources, planar path)', () => {
  const f16Plan = planReadback(W, H, 'rgba16float');
  const f16Padded = new Uint8Array(f16Plan.byteLength);
  for (let i = 0; i < f16Padded.length; i += 1) f16Padded[i] = (i * 17) & 0xff;
  const f16Out = new Uint8Array(W * H * 4);
  const f16Planar = new Float32Array(3 * W * H);
  bench('unpackReadback 640x360 rgba16float', () => {
    unpackReadback(f16Padded, W, H, 'rgba16float', f16Out);
  });
  bench('unpackReadbackToPlanarRgb 640x360 rgba16float', () => {
    unpackReadbackToPlanarRgb(f16Padded, W, H, 'rgba16float', f16Planar);
  });
});
