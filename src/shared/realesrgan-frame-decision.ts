/**
 * Frame-Entscheidung (per-frame decision core) for the RealESRGAN drain.
 *
 * One module owns the pure decision chain whose ORDER carries correctness:
 * the letterbox sequence (verify the adopted rect against the current bars →
 * reset on a miss → fresh detection on cadence → snap outward to the
 * transport-target grid), the inference/target geometry for the chosen
 * crop, and the still-frame hold gate over the exact runner input. The
 * drain (GPU glue) consumes the decisions; the trackers (LetterboxTracker,
 * StillframeTracker) stay stateful at their owner and are passed in, so
 * every rule here is testable without a GPUDevice.
 *
 * Order contract (violating it amputates content or freezes output):
 *   1. verify BEFORE observing — a stale rect must reset before a new
 *      detection can adopt on top of it;
 *   2. verify against the UNPACKED bytes of THIS frame — the bars are
 *      re-checked every frame, detection only runs on cadence;
 *   3. snap AFTER adoption — growing only ever adds near-black pixels;
 *   4. the still-frame hold hashes the exact runner input (post-crop), so a
 *      crop change changes the geometry key and resets the run.
 */
import {
  contentRectKey,
  detectContentRectPlanar,
  detectContentRectRgba,
  fullContentRect,
  isFullFrame,
  snapCropToTargetGrid,
  verifyCropHoldsPlanar,
  verifyCropHoldsRgba,
  type ContentRect,
  type LetterboxTracker,
} from './realesrgan-letterbox';
import {
  STILLFRAME_HOLD_AFTER,
  hashFrameBytes,
  type StillframeTracker,
} from './realesrgan-stillframe';

export interface FrameContentState {
  /** Full inference dims (post maxInferenceHeight cap). */
  width: number;
  height: number;
  /** Unpacked bytes of THIS frame; exactly one form is present. */
  tightRgba: Uint8Array | null;
  planar: Float32Array | null;
  cropTracker: LetterboxTracker;
  /** Transport presentation target (0 = no target, full 4x). */
  transportTargetWidth: number;
  transportTargetHeight: number;
}

export interface FrameContentDecision {
  /** Content rect after verify/reset/poll/observe/snap. */
  crop: ContentRect;
  /** False when the rect is the full frame (no cropping this frame). */
  cropActive: boolean;
}

/**
 * Run the letterbox decision chain for one unpacked frame. Mutates the
 * tracker exactly like the drain did (verify-reset, cadence observe) and
 * returns the rect to infer.
 */
export function decideFrameContent(state: FrameContentState): FrameContentDecision {
  const fullW = state.width;
  const fullH = state.height;
  let crop = state.cropTracker.current(fullW, fullH);
  if (!isFullFrame(crop, fullW, fullH)) {
    const holds = state.tightRgba
      ? verifyCropHoldsRgba(state.tightRgba, fullW, fullH, crop)
      : state.planar
        ? verifyCropHoldsPlanar(state.planar, fullW, fullH, crop)
        : false;
    if (!holds) {
      state.cropTracker.reset();
      crop = state.cropTracker.current(fullW, fullH);
    }
  }
  if (state.cropTracker.poll()) {
    const detected = state.tightRgba
      ? detectContentRectRgba(state.tightRgba, fullW, fullH)
      : state.planar
        ? detectContentRectPlanar(state.planar, fullW, fullH)
        : fullContentRect(fullW, fullH);
    crop = state.cropTracker.observe(detected, fullW, fullH);
  }
  // Snap outward to the transport-target grid (no-op without a target):
  // keeps every content paste origin integer-exact on the downscaled
  // native path. Growing only ever adds near-black pixels, never cuts.
  if (!isFullFrame(crop, fullW, fullH)
    && state.transportTargetWidth > 0 && state.transportTargetHeight > 0) {
    crop = snapCropToTargetGrid(crop, fullW, fullH, state.transportTargetWidth, state.transportTargetHeight);
  }
  return { crop, cropActive: !isFullFrame(crop, fullW, fullH) };
}

export interface CropGeometry {
  /** Dims the runner infers (crop dims when cropping, full dims else). */
  inferWidth: number;
  inferHeight: number;
  /**
   * Transport target for the inference input: proportional to the crop with
   * aspect preserved, clamped to the 4x content output (the host clamps to
   * the 4x content output either way). 0 = no target (full 4x).
   */
  targetWidth: number;
  targetHeight: number;
}

/** Target geometry for a decided crop: crop dims plus the proportional transport target. */
export function planCropGeometry(
  crop: ContentRect,
  fullW: number,
  fullH: number,
  transportTargetWidth: number,
  transportTargetHeight: number,
): CropGeometry {
  const cropActive = !isFullFrame(crop, fullW, fullH);
  const inferWidth = cropActive ? crop.width : fullW;
  const inferHeight = cropActive ? crop.height : fullH;
  let targetWidth = transportTargetWidth;
  let targetHeight = transportTargetHeight;
  if (cropActive && targetWidth > 0 && targetHeight > 0) {
    targetWidth = Math.min(inferWidth * 4, Math.max(1, Math.round(targetWidth * inferWidth / fullW)));
    targetHeight = Math.min(inferHeight * 4, Math.max(1, Math.round(targetHeight * inferHeight / fullH)));
  }
  return { inferWidth, inferHeight, targetWidth, targetHeight };
}

/** Geometry key for the still-frame hold: the exact inference shape plus the
 * content rect, so a crop change resets the identical-run counter even when
 * the hashed bytes happen to repeat.
 */
export function stillframeGeometryKey(inferWidth: number, inferHeight: number, crop: ContentRect): string {
  return `${inferWidth}x${inferHeight}:${contentRectKey(crop)}`;
}

export interface CropPaste {
  ox: number;
  oy: number;
}

export type CropPasteDecision =
  /** Paste the validated result bytes at the (possibly shifted) origin. */
  | { kind: 'paste'; paste: CropPaste }
  /** The bytes cannot be presented here: skip like a superseded result. */
  | { kind: 'skip' };

/**
 * Where a cropped result lands on the output texture. Origin rounding can
 * overshoot the far edge by ~1px on odd splits (round(y)+round(h) vs
 * round(y+h)): shift back inside instead of dropping the frame — subpixel,
 * invisible, and the bar fill uses the same rect so no seam can open.
 * Anything larger means the bytes genuinely do not fit (e.g. a main-thread
 * crop result meeting a target-sized texture after the runner died): skip
 * instead of throwing successful inferences into the fatal budget.
 */
export function decideCropPaste(
  crop: ContentRect,
  inferWidth: number,
  inferHeight: number,
  outWidth: number,
  outHeight: number,
  resultWidth: number,
  resultHeight: number,
): CropPasteDecision {
  let ox = Math.round(outWidth * crop.x / inferWidth);
  let oy = Math.round(outHeight * crop.y / inferHeight);
  if (ox < 0 || oy < 0) {
    throw new Error(`RealESRGAN crop paste ${ox},${oy} ${resultWidth}x${resultHeight} does not fit `
      + `in ${outWidth}x${outHeight}.`);
  }
  const overX = ox + resultWidth - outWidth;
  const overY = oy + resultHeight - outHeight;
  if (overX > 2 || overY > 2) return { kind: 'skip' };
  if (overX > 0) ox -= overX;
  if (overY > 0) oy -= overY;
  return { kind: 'paste', paste: { ox, oy } };
}

export interface StillframeHoldState {
  stillTracker: StillframeTracker;
  /** The exact runner input bytes (post-crop, either form). */
  hashBytes: Uint8Array;
  geometryKey: string;
  /** No hold before the first real result landed (prime owns the canvas). */
  firstResultLanded: boolean;
}

/**
 * Still-frame hold gate: observe the runner input ALWAYS (the run counter
 * must advance even before the first result lands) and hold only when a
 * result is presented and the exact input repeated often enough.
 */
export function shouldHoldPresentedResult(state: StillframeHoldState): boolean {
  const identicalRun = state.stillTracker.observe(
    hashFrameBytes(state.hashBytes),
    state.geometryKey,
  );
  return state.firstResultLanded && identicalRun >= STILLFRAME_HOLD_AFTER;
}
