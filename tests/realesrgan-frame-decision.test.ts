/**
 * Frame-Entscheidung (realesrgan-frame-decision): the pure per-frame decision
 * chain the drain used to hide inside GPU glue. The letterbox sequence's
 * ORDER carries correctness (verify before observe, snap after adoption),
 * and the still-frame hold gates on the exact runner input — all testable
 * here without a GPUDevice, through the real trackers.
 */
import { describe, expect, it } from 'vitest';
import {
  decideFrameContent,
  planCropGeometry,
  shouldHoldPresentedResult,
  stillframeGeometryKey,
} from '../src/shared/realesrgan-frame-decision';
import { LetterboxTracker } from '../src/shared/realesrgan-letterbox';
import { StillframeTracker } from '../src/shared/realesrgan-stillframe';

const FULL = 128;

/** Planar RGB frame with a solid content rect (value 1) and black bars (0). */
function planarFrame(content: { x: number; y: number; width: number; height: number }): Float32Array {
  const data = new Float32Array(3 * FULL * FULL);
  for (let y = content.y; y < content.y + content.height; y += 1) {
    for (let x = content.x; x < content.x + content.width; x += 1) {
      const p = y * FULL + x;
      data[p] = 1;
      data[p + FULL * FULL] = 1;
      data[p + 2 * FULL * FULL] = 1;
    }
  }
  return data;
}

function decide(
  planar: Float32Array,
  tracker: LetterboxTracker,
  targetWidth = 0,
  targetHeight = 0,
) {
  return decideFrameContent({
    width: FULL,
    height: FULL,
    tightRgba: null,
    planar,
    cropTracker: tracker,
    transportTargetWidth: targetWidth,
    transportTargetHeight: targetHeight,
  });
}

describe('decideFrameContent (letterbox sequence)', () => {
  it('never crops on a single detection (shrink needs confirmations)', () => {
    const tracker = new LetterboxTracker();
    const frame = planarFrame({ x: 0, y: 16, width: FULL, height: 96 });
    const first = decide(frame, tracker);
    expect(first.cropActive).toBe(false);
    // And the next frame (no poll cadence) stays full until adoption.
    expect(decide(frame, tracker).cropActive).toBe(false);
  });

  it('keeps an adopted rect while the bars hold', () => {
    const tracker = new LetterboxTracker();
    const rect = { x: 0, y: 16, width: FULL, height: 96 };
    // Seed adoption through the tracker's own two-confirmation rule.
    tracker.observe(rect, FULL, FULL);
    tracker.observe(rect, FULL, FULL);
    const frame = planarFrame(rect);
    const decision = decide(frame, tracker);
    expect(decision.cropActive).toBe(true);
    expect(decision.crop).toEqual(rect);
  });

  it('falls back to the full frame when the bars no longer hold (scene cut)', () => {
    const tracker = new LetterboxTracker();
    const rect = { x: 0, y: 16, width: FULL, height: 96 };
    tracker.observe(rect, FULL, FULL);
    tracker.observe(rect, FULL, FULL);
    // Content floods the previously-barred region: the verify must veto.
    const flooded = planarFrame({ x: 0, y: 0, width: FULL, height: FULL });
    const decision = decide(flooded, tracker);
    expect(decision.cropActive).toBe(false);
    expect(decision.crop).toEqual({ x: 0, y: 0, width: FULL, height: FULL });
  });

  it('snaps the adopted rect outward to the transport-target grid', () => {
    const tracker = new LetterboxTracker();
    const rect = { x: 1, y: 3, width: 125, height: 105 };
    tracker.observe(rect, FULL, FULL);
    tracker.observe(rect, FULL, FULL);
    const frame = planarFrame(rect);
    // Target 64x64 on a 128x128 frame → 2px grid; the raw rect sits off-grid.
    const snapped = decide(frame, tracker, 64, 64);
    expect(snapped.cropActive).toBe(true);
    expect(snapped.crop).toEqual({ x: 0, y: 2, width: 126, height: 106 });
  });
});

describe('planCropGeometry', () => {
  it('passes the transport target through on the full frame', () => {
    const geometry = planCropGeometry({ x: 0, y: 0, width: FULL, height: FULL }, FULL, FULL, 640, 360);
    expect(geometry).toEqual({ inferWidth: FULL, inferHeight: FULL, targetWidth: 640, targetHeight: 360 });
  });

  it('scales the target proportionally with the crop and clamps to 4x content', () => {
    const crop = { x: 0, y: 16, width: FULL, height: 96 };
    const geometry = planCropGeometry(crop, FULL, FULL, 64, 64);
    expect(geometry.inferWidth).toBe(FULL);
    expect(geometry.inferHeight).toBe(96);
    expect(geometry.targetWidth).toBe(64);
    expect(geometry.targetHeight).toBe(48);
  });

  it('keeps target 0 when no transport target is configured', () => {
    const geometry = planCropGeometry({ x: 0, y: 16, width: FULL, height: 96 }, FULL, FULL, 0, 0);
    expect(geometry.targetWidth).toBe(0);
    expect(geometry.targetHeight).toBe(0);
  });
});

describe('still-frame hold gate', () => {
  const bytes = new Uint8Array(64).fill(7);

  it('holds only after the first result landed and the input repeated', () => {
    const stillTracker = new StillframeTracker();
    const key = stillframeGeometryKey(64, 64, { x: 0, y: 0, width: 64, height: 64 });
    const state = { stillTracker, hashBytes: bytes, geometryKey: key, firstResultLanded: false };
    // The run counter advances even while nothing is presented yet.
    expect(shouldHoldPresentedResult(state)).toBe(false);
    expect(shouldHoldPresentedResult(state)).toBe(false);
    expect(shouldHoldPresentedResult({ ...state, firstResultLanded: true })).toBe(true);
  });

  it('resets the run when the geometry key changes (crop change)', () => {
    const stillTracker = new StillframeTracker();
    const cropA = { x: 0, y: 0, width: 64, height: 64 };
    const cropB = { x: 0, y: 8, width: 64, height: 64 };
    expect(shouldHoldPresentedResult({
      stillTracker, hashBytes: bytes, geometryKey: stillframeGeometryKey(64, 64, cropA), firstResultLanded: true,
    })).toBe(false);
    expect(shouldHoldPresentedResult({
      stillTracker, hashBytes: bytes, geometryKey: stillframeGeometryKey(64, 64, cropA), firstResultLanded: true,
    })).toBe(false);
    expect(shouldHoldPresentedResult({
      stillTracker, hashBytes: bytes, geometryKey: stillframeGeometryKey(64, 64, cropA), firstResultLanded: true,
    })).toBe(true);
    // Same bytes, different crop: the run restarts, no hold.
    expect(shouldHoldPresentedResult({
      stillTracker, hashBytes: bytes, geometryKey: stillframeGeometryKey(64, 64, cropB), firstResultLanded: true,
    })).toBe(false);
  });

  it('distinguishes inference shapes in the geometry key', () => {
    const crop = { x: 0, y: 0, width: 64, height: 64 };
    expect(stillframeGeometryKey(64, 64, crop)).not.toBe(stillframeGeometryKey(60, 64, crop));
  });
});
