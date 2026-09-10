import { bench, describe } from 'vitest';
import {
  rgbaToPlanarRgb,
  rgbPlanarToRgba,
  rgbPlanarToPaddedRgba,
  extractTileRgb,
  featherRamp,
} from '../src/shared/realesrgan-tensor';
import { planReadback } from '../src/shared/realesrgan-readback';

function makeRgba(w: number, h: number): Uint8Array {
  const a = new Uint8Array(w * h * 4);
  for (let i = 0; i < a.length; i++) a[i] = (i * 37) & 0xff;
  for (let i = 3; i < a.length; i += 4) a[i] = 255;
  return a;
}

function makePlanar(w: number, h: number): Float32Array {
  const p = new Float32Array(3 * w * h);
  for (let i = 0; i < p.length; i++) p[i] = (i % 256) / 255;
  return p;
}

// Prebuilt fixtures (shared across iterations — callees allocate new outputs)
const rgba640 = makeRgba(640, 360);
const planar640 = makePlanar(640, 360);
const rgba720 = makeRgba(1280, 720);
const planar720 = makePlanar(1280, 720);
const rgba1080 = makeRgba(1920, 1080);
const planar1080 = makePlanar(1920, 1080);

// Small fixture for tile extract: 1280x720 source, extract 512x512 tile
const largePlanar720 = makePlanar(1280, 720);

describe('rgbaToPlanarRgb', () => {
  bench('640x360', () => {
    rgbaToPlanarRgb(rgba640, 640, 360);
  });
  bench('1280x720', () => {
    rgbaToPlanarRgb(rgba720, 1280, 720);
  });
  // 1920x1080 is heavy (~2M pixels => 6M floats). Keep one sample for regression.
  bench('1920x1080', () => {
    rgbaToPlanarRgb(rgba1080, 1920, 1080);
  });
});

describe('rgbPlanarToRgba', () => {
  bench('640x360', () => {
    rgbPlanarToRgba(planar640, 640, 360);
  });
  bench('1280x720', () => {
    rgbPlanarToRgba(planar720, 1280, 720);
  });
  bench('1920x1080', () => {
    rgbPlanarToRgba(planar1080, 1920, 1080);
  });
});

describe('rgbPlanarToPaddedRgba (fused pad)', () => {
  // Tight row (no pad) should be identity to rgbPlanarToRgba
  bench('640x360 tight (bytesPerRow = w*4)', () => {
    rgbPlanarToPaddedRgba(planar640, 640, 360, 640 * 4);
  });
  bench('640x360 padded (WebGPU 256-aligned)', () => {
    const { bytesPerRow } = planReadback(640, 360, 'rgba8unorm');
    rgbPlanarToPaddedRgba(planar640, 640, 360, bytesPerRow);
  });
  bench('1280x720 padded', () => {
    const { bytesPerRow } = planReadback(1280, 720, 'rgba8unorm');
    rgbPlanarToPaddedRgba(planar720, 1280, 720, bytesPerRow);
  });
  bench('1280x720 padded with reused out buffer', () => {
    const { bytesPerRow } = planReadback(1280, 720, 'rgba8unorm');
    const out = new Uint8Array(bytesPerRow * 720);
    rgbPlanarToPaddedRgba(planar720, 1280, 720, bytesPerRow, out);
  });
});

describe('extractTileRgb', () => {
  bench('512x512 tile from 1280x720 @ 0,0', () => {
    extractTileRgb(largePlanar720, 1280, 720, 0, 0, 512, 512);
  });
  bench('512x512 tile from 1280x720 @ 400,100', () => {
    extractTileRgb(largePlanar720, 1280, 720, 400, 100, 512, 512);
  });
  bench('256x256 tile from 640x360', () => {
    extractTileRgb(planar640, 640, 360, 64, 32, 256, 256);
  });
});

describe('featherRamp', () => {
  bench('length 2048 window 48 (typical 512*4)', () => {
    featherRamp(2048, 48);
  });
  bench('length 1536 window 48 (384*4)', () => {
    featherRamp(1536, 48);
  });
  bench('length 256 window 8 (small tile)', () => {
    featherRamp(256, 8);
  });
});
