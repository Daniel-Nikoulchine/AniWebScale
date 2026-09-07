/**
 * Hebel 1.1 tests: letterbox detection, rect slicing, target-grid snapping
 * and the adoption hysteresis of the LetterboxTracker.
 */
import { describe, expect, it } from 'vitest';
import {
  contentRectKey,
  cropPlanarRect,
  cropRgbaRect,
  detectContentRectPlanar,
  detectContentRectRgba,
  fullContentRect,
  isFullFrame,
  LETTERBOX_REDETECT_INTERVAL,
  LetterboxTracker,
  rectCovers,
  rectEquals,
  savedFraction,
  snapCropToTargetGrid,
  verifyCropHoldsPlanar,
  verifyCropHoldsRgba,
} from '../src/shared/realesrgan-letterbox';

const W = 64;
const H = 48;

/** Frame with black bars top/bottom, content rows filled with `value`. */
function letterboxedRgba(top: number, bottom: number, value: number): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let y = top; y < H - bottom; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const o = (y * W + x) * 4;
      data[o] = value; data[o + 1] = value; data[o + 2] = value; data[o + 3] = 255;
    }
  }
  return data;
}

function toPlanar(rgba: Uint8Array): Float32Array {
  const pixels = W * H;
  const out = new Float32Array(3 * pixels);
  for (let p = 0; p < pixels; p += 1) {
    out[p] = rgba[p * 4]! / 255;
    out[p + pixels] = rgba[p * 4 + 1]! / 255;
    out[p + 2 * pixels] = rgba[p * 4 + 2]! / 255;
  }
  return out;
}

describe('detectContentRectRgba', () => {
  it('finds top/bottom letterbox bars', () => {
    const rect = detectContentRectRgba(letterboxedRgba(6, 8, 200), W, H);
    expect(rect).toEqual({ x: 0, y: 6, width: W, height: H - 14 });
  });

  it('finds pillarbox side bars', () => {
    const data = new Uint8Array(W * H * 4).fill(0);
    for (let y = 0; y < H; y += 1) {
      for (let x = 10; x < W - 12; x += 1) {
        const o = (y * W + x) * 4;
        data[o] = 180; data[o + 1] = 120; data[o + 2] = 60; data[o + 3] = 255;
      }
    }
    expect(detectContentRectRgba(data, W, H)).toEqual({ x: 10, y: 0, width: W - 22, height: H });
  });

  it('returns the full frame when nothing is black', () => {
    const data = new Uint8Array(W * H * 4).fill(200);
    expect(detectContentRectRgba(data, W, H)).toEqual(fullContentRect(W, H));
  });

  it('returns the full frame on fade-to-black (never a degenerate rect)', () => {
    expect(detectContentRectRgba(new Uint8Array(W * H * 4), W, H)).toEqual(fullContentRect(W, H));
  });

  it('treats threshold-edge pixels as black, threshold+1 as content', () => {
    // Bar rows at exactly 4 must crop; content at 5 must stop the crop.
    const edge = letterboxedRgba(4, 0, 5);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const o = (y * W + x) * 4;
        edge[o] = 4; edge[o + 1] = 4; edge[o + 2] = 4;
      }
    }
    expect(detectContentRectRgba(edge, W, H)).toEqual({ x: 0, y: 4, width: W, height: H - 4 });
  });

  it('does not crop a dark-but-not-black scene (single bright pixel stops the bar)', () => {
    // Bar rows at 3 (dark, under threshold) with one over-threshold pixel in
    // row 0: that row is content, so no top crop happens at all.
    const data = letterboxedRgba(6, 6, 100);
    for (let y = 0; y < 6; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const o = (y * W + x) * 4;
        data[o] = 3; data[o + 1] = 3; data[o + 2] = 3;
      }
    }
    data[(0 * W + 30) * 4] = 200;
    const rect = detectContentRectRgba(data, W, H);
    expect(rect.y).toBe(0);
  });

  it('agrees with the planar detector on the same frame', () => {
    const rgba = letterboxedRgba(5, 7, 150);
    // Pillarbox the content rows as well for a non-trivial rect.
    for (let y = 5; y < H - 7; y += 1) {
      for (const x of [0, 1, W - 2, W - 1]) {
        const o = (y * W + x!) * 4;
        rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0;
      }
    }
    // Rebuild: content block with side bars zeroed.
    const frame = new Uint8Array(W * H * 4);
    for (let y = 5; y < H - 7; y += 1) {
      for (let x = 2; x < W - 2; x += 1) {
        const o = (y * W + x) * 4;
        frame[o] = 150; frame[o + 1] = 150; frame[o + 2] = 150; frame[o + 3] = 255;
      }
    }
    const expected = { x: 2, y: 5, width: W - 4, height: H - 12 };
    expect(detectContentRectRgba(frame, W, H)).toEqual(expected);
    expect(detectContentRectPlanar(toPlanar(frame), W, H)).toEqual(expected);
  });

  it('rejects short buffers', () => {
    expect(() => detectContentRectRgba(new Uint8Array(10), W, H)).toThrow();
    expect(() => detectContentRectPlanar(new Float32Array(10), W, H)).toThrow();
  });
});

describe('rect helpers', () => {
  it('isFullFrame / rectEquals / rectCovers / savedFraction / key', () => {
    expect(isFullFrame(fullContentRect(W, H), W, H)).toBe(true);
    expect(isFullFrame({ x: 0, y: 1, width: W, height: H - 1 }, W, H)).toBe(false);
    expect(rectEquals({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 })).toBe(true);
    expect(rectCovers(fullContentRect(W, H), { x: 2, y: 2, width: 10, height: 10 })).toBe(true);
    expect(rectCovers({ x: 2, y: 2, width: 10, height: 10 }, fullContentRect(W, H))).toBe(false);
    expect(savedFraction(fullContentRect(W, H), W, H)).toBe(0);
    expect(savedFraction({ x: 0, y: 6, width: W, height: H - 12 }, W, H)).toBeCloseTo(12 / H, 10);
    expect(contentRectKey({ x: 1, y: 2, width: 3, height: 4 })).toBe('1,2,3x4');
  });
});

describe('cropRgbaRect / cropPlanarRect', () => {
  it('slices the exact rect rows (RGBA)', () => {
    const src = new Uint8Array(W * H * 4);
    for (let i = 0; i < src.length; i += 1) src[i] = i % 251;
    const rect = { x: 5, y: 7, width: 20, height: 9 };
    const out = cropRgbaRect(src, W, H, rect, new Uint8Array(20 * 9 * 4));
    for (let row = 0; row < 9; row += 1) {
      const expected = src.subarray(((7 + row) * W + 5) * 4, ((7 + row) * W + 25) * 4);
      expect(out.subarray(row * 80, row * 80 + 80)).toEqual(expected);
    }
  });

  it('slices per-channel planes (planar)', () => {
    const src = new Float32Array(3 * W * H);
    for (let i = 0; i < src.length; i += 1) src[i] = (i % 997) / 997;
    const rect = { x: 3, y: 4, width: 16, height: 6 };
    const out = cropPlanarRect(src, W, H, rect, new Float32Array(3 * 16 * 6));
    for (let c = 0; c < 3; c += 1) {
      for (let row = 0; row < 6; row += 1) {
        const expected = src.subarray(c * W * H + (4 + row) * W + 3, c * W * H + (4 + row) * W + 19);
        expect(out.subarray(c * 96 + row * 16, c * 96 + row * 16 + 16)).toEqual(expected);
      }
    }
  });

  it('rejects wrong-size buffers', () => {
    const rect = { x: 0, y: 0, width: 8, height: 8 };
    expect(() => cropRgbaRect(new Uint8Array(W * H * 4), W, H, rect, new Uint8Array(7))).toThrow();
    expect(() => cropRgbaRect(new Uint8Array(7), W, H, rect, new Uint8Array(8 * 8 * 4))).toThrow();
    expect(() => cropPlanarRect(new Float32Array(3 * W * H), W, H, rect, new Float32Array(7))).toThrow();
  });
});

describe('verifyCropHoldsRgba / verifyCropHoldsPlanar', () => {
  const crop = { x: 0, y: 6, width: W, height: H - 12 };

  it('holds while bars stay black', () => {
    const frame = letterboxedRgba(6, 6, 150);
    expect(verifyCropHoldsRgba(frame, W, H, crop)).toBe(true);
    expect(verifyCropHoldsPlanar(toPlanar(frame), W, H, crop)).toBe(true);
  });

  it('vetoes when a subtitle fades into the bar area', () => {
    const frame = letterboxedRgba(6, 6, 150);
    // Subtitle glyph row inside the top bar.
    for (let x = 20; x < 44; x += 1) {
      const o = (2 * W + x) * 4;
      frame[o] = 255; frame[o + 1] = 255; frame[o + 2] = 255;
    }
    expect(verifyCropHoldsRgba(frame, W, H, crop)).toBe(false);
    expect(verifyCropHoldsPlanar(toPlanar(frame), W, H, crop)).toBe(false);
  });

  it('vetoes when the scene cuts to full-frame content', () => {
    const frame = new Uint8Array(W * H * 4).fill(150);
    expect(verifyCropHoldsRgba(frame, W, H, crop)).toBe(false);
  });

  it('holds trivially for a full-frame crop', () => {
    const frame = new Uint8Array(W * H * 4).fill(150);
    expect(verifyCropHoldsRgba(frame, W, H, fullContentRect(W, H))).toBe(true);
  });
});

describe('snapCropToTargetGrid', () => {
  it('is a no-op without a target', () => {
    const rect = { x: 3, y: 5, width: 847, height: 470 };
    expect(snapCropToTargetGrid(rect, 853, 480, 0, 0)).toEqual(rect);
  });

  it('snaps outward only and keeps integer target edges', () => {
    // x is already frame-wide (step 853 exceeds the cheap-snap bound, so it
    // is left as-is); the y grid is fine (480 -> 720: step 2) and snaps.
    const rect = { x: 0, y: 30, width: 853, height: 420 };
    const snapped = snapCropToTargetGrid(rect, 853, 480, 1280, 720);
    expect(rectCovers(snapped, rect)).toBe(true);
    expect((1280 * snapped.x) % 853).toBe(0);
    expect((1280 * (snapped.x + snapped.width)) % 853).toBe(0);
    expect((720 * snapped.y) % 480).toBe(0);
    expect((720 * (snapped.y + snapped.height)) % 480).toBe(0);
  });

  it('does not balloon a pillarbox crop on a degenerate (coprime) grid', () => {
    // gcd(853, 1280) = 1 -> step 853: an outward snap would grow the crop to
    // the full frame and silently disable cropping, so the degenerate axis
    // keeps its fractional alignment instead.
    const rect = { x: 107, y: 0, width: 640, height: 480 };
    expect(snapCropToTargetGrid(rect, 853, 480, 1280, 720)).toEqual(rect);
  });

  it('leaves aligned rects untouched', () => {
    const rect = { x: 0, y: 0, width: 640, height: 360 };
    expect(snapCropToTargetGrid(rect, 640, 360, 1280, 720)).toEqual(rect);
  });
});

describe('LetterboxTracker', () => {
  // Tracker tests use production-scale frames: worthCropping() deliberately
  // rejects content rects below 64px per axis (degenerate runner inputs).
  const TW = 320;
  const TH = 240;
  const full = () => fullContentRect(TW, TH);
  const shrink = () => ({ x: 0, y: 30, width: TW, height: TH - 60 });

  it('detects on the first poll, then every interval', () => {
    const tracker = new LetterboxTracker();
    expect(tracker.poll()).toBe(true);
    for (let i = 1; i < LETTERBOX_REDETECT_INTERVAL; i += 1) expect(tracker.poll()).toBe(false);
    expect(tracker.poll()).toBe(true);
  });

  it('starts full-frame and adopts a confirmed shrink after two detections', () => {
    const tracker = new LetterboxTracker();
    expect(tracker.current(TW, TH)).toEqual(full());
    // First sighting: not trusted yet.
    expect(tracker.observe(shrink(), TW, TH)).toEqual(full());
    // Second consecutive sighting: adopted.
    expect(tracker.observe(shrink(), TW, TH)).toEqual(shrink());
    expect(tracker.current(TW, TH)).toEqual(shrink());
  });

  it('ignores a one-off dark frame (no flicker)', () => {
    const tracker = new LetterboxTracker();
    expect(tracker.observe(shrink(), TW, TH)).toEqual(full());
    expect(tracker.observe(full(), TW, TH)).toEqual(full());
    expect(tracker.current(TW, TH)).toEqual(full());
  });

  it('adopts growth immediately (scene cut is always safe)', () => {
    const tracker = new LetterboxTracker();
    tracker.observe(shrink(), TW, TH);
    tracker.observe(shrink(), TW, TH);
    expect(tracker.current(TW, TH)).toEqual(shrink());
    expect(tracker.observe(full(), TW, TH)).toEqual(full());
  });

  it('rejects shrink below the savings gate (peanuts stay full-frame)', () => {
    const tracker = new LetterboxTracker();
    // Two rows saved on a 480-row frame: 0.4% < 1% gate — confirmed twice,
    // still rejected; the bar rewrite is not worth sub-percent savings.
    const bigW = 640;
    const bigH = 480;
    const peanuts = { x: 0, y: 1, width: bigW, height: bigH - 2 };
    tracker.observe(peanuts, bigW, bigH);
    expect(tracker.observe(peanuts, bigW, bigH)).toEqual(fullContentRect(bigW, bigH));
    // A real letterbox (12.5%) on the same frame is adopted.
    const real = { x: 0, y: 30, width: bigW, height: bigH - 60 };
    tracker.observe(real, bigW, bigH);
    expect(tracker.observe(real, bigW, bigH)).toEqual(real);
  });

  it('rejects degenerate rects even when confirmed', () => {
    const tracker = new LetterboxTracker();
    const tiny = { x: 0, y: 0, width: 10, height: 10 };
    tracker.observe(tiny, TW, TH);
    expect(tracker.observe(tiny, TW, TH)).toEqual(full());
  });

  it('reset() restores first-detect behaviour', () => {
    const tracker = new LetterboxTracker();
    tracker.observe(shrink(), TW, TH);
    tracker.observe(shrink(), TW, TH);
    tracker.reset();
    expect(tracker.current(TW, TH)).toEqual(full());
    expect(tracker.poll()).toBe(true);
  });
});
