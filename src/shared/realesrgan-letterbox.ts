/**
 * Letterbox detection and content-rect slicing for the RealESRGAN path
 * (Hebel 1.1: schwarze Balken nie inferieren).
 *
 * Anime frames are routinely letter- or pillarboxed (16:9 content in a 4:3
 * container, Cinemascope, vignettes). Inference cost scales linearly with
 * pixels, so every all-black row/column fed through the 16 body layers is
 * pure waste: the network computes a deterministic answer over black.
 * Detecting the content rectangle once per scene and inferring only it saves
 * GMACs, transport bytes and upload bytes at once.
 *
 * Quality contract: content pixels are bit-identical (they run through the
 * same model with the same weights); only the bars are re-attached as opaque
 * black instead of "upscaled black". A bar pixel is, by definition, not
 * content, so this is the `bit-identisch*` tier of the perf page.
 *
 * Detection runs on the already-unpacked frame bytes (tight RGBA8 or planar
 * floats — the thresholds are exactly equivalent: byte <= 4 <=> float <=
 * 4/255, and the float16 path quantises through 8-bit first). A row/column
 * counts as black only when EVERY pixel across the full span is at or below
 * the threshold, so dark scenes, fades and film grain never crop.
 *
 * Adoption is hysteretic: growing the content rect (bars shrank, scene cut)
 * applies immediately — inferring more can never lose content — while
 * shrinking it needs two consecutive identical detections, so a single dark
 * frame cannot amputate real content for the next 30 frames. A fully black
 * frame (fade to black) yields the full frame, never a degenerate rect.
 */

export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Per-channel black threshold on 8-bit bytes (<= 4/255). */
export const LETTERBOX_BYTE_THRESHOLD = 4;
/** Same threshold on planar [0,1] floats. Exactly equivalent for 8-bit sources. */
export const LETTERBOX_FLOAT_THRESHOLD = 4 / 255;
/** Fresh detection every Nth processed frame; geometry is reused between runs. */
export const LETTERBOX_REDETECT_INTERVAL = 30;
/** Consecutive identical detections required before the rect may shrink. */
export const LETTERBOX_SHRINK_CONFIRMATIONS = 2;
/** Minimum pixel saving for a shrink to be worth the bar-rewrite bookkeeping. */
export const LETTERBOX_MIN_SAVED_FRAC = 0.01;
/** Content rects smaller than this are treated as "no content found". */
export const LETTERBOX_MIN_CONTENT_DIM = 64;

export function fullContentRect(width: number, height: number): ContentRect {
  return { x: 0, y: 0, width, height };
}

export function isFullFrame(rect: ContentRect, width: number, height: number): boolean {
  return rect.x === 0 && rect.y === 0 && rect.width === width && rect.height === height;
}

export function rectEquals(a: ContentRect, b: ContentRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** True when `outer` covers `inner` completely (growing is always safe). */
export function rectCovers(outer: ContentRect, inner: ContentRect): boolean {
  return outer.x <= inner.x
    && outer.y <= inner.y
    && outer.x + outer.width >= inner.x + inner.width
    && outer.y + outer.height >= inner.y + inner.height;
}

/** Fraction of frame pixels the rect crops away (0 for full frame). */
export function savedFraction(rect: ContentRect, width: number, height: number): number {
  const total = width * height;
  if (total <= 0) return 0;
  return 1 - (rect.width * rect.height) / total;
}

/** Stable key for change detection (crop geometry + presentation mapping). */
export function contentRectKey(rect: ContentRect): string {
  return `${rect.x},${rect.y},${rect.width}x${rect.height}`;
}

function clampRect(rect: ContentRect, width: number, height: number): ContentRect {
  const x = Math.min(Math.max(0, rect.x), width);
  const y = Math.min(Math.max(0, rect.y), height);
  return {
    x,
    y,
    width: Math.min(Math.max(0, rect.width), width - x),
    height: Math.min(Math.max(0, rect.height), height - y),
  };
}

/**
 * Find the content rectangle in tightly packed RGBA8 bytes. A row/column is
 * black only when max(R,G,B) <= threshold for every pixel across its full
 * span; alpha is ignored (video is opaque, bars included).
 */
export function detectContentRectRgba(
  data: Uint8Array,
  width: number,
  height: number,
  threshold = LETTERBOX_BYTE_THRESHOLD,
): ContentRect {
  if (data.length < width * height * 4) {
    throw new Error(`detectContentRectRgba: need ${width * height * 4} bytes, got ${data.length}.`);
  }
  const rowIsBlack = (y: number): boolean => {
    const base = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const o = base + x * 4;
      if (data[o] > threshold || data[o + 1] > threshold || data[o + 2] > threshold) return false;
    }
    return true;
  };
  let top = 0;
  while (top < height && rowIsBlack(top)) top += 1;
  // Fully black frame (fade to black): no content rect exists, keep it whole.
  if (top >= height) return fullContentRect(width, height);
  let bottom = height - 1;
  while (bottom > top && rowIsBlack(bottom)) bottom -= 1;
  const colIsBlack = (x: number): boolean => {
    for (let y = top; y <= bottom; y += 1) {
      const o = (y * width + x) * 4;
      if (data[o] > threshold || data[o + 1] > threshold || data[o + 2] > threshold) return false;
    }
    return true;
  };
  let left = 0;
  while (left < width && colIsBlack(left)) left += 1;
  if (left >= width) return fullContentRect(width, height);
  let right = width - 1;
  while (right > left && colIsBlack(right)) right -= 1;
  return clampRect({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, width, height);
}

/**
 * Same contract on planar [0,1] floats (channel-major, 3 * width * height).
 * Used on the pre-fast-path frames where only planar input exists.
 */
export function detectContentRectPlanar(
  data: Float32Array,
  width: number,
  height: number,
  threshold = LETTERBOX_FLOAT_THRESHOLD,
): ContentRect {
  const pixels = width * height;
  if (data.length < 3 * pixels) {
    throw new Error(`detectContentRectPlanar: need ${3 * pixels} floats, got ${data.length}.`);
  }
  const rowIsBlack = (y: number): boolean => {
    const base = y * width;
    for (let x = 0; x < width; x += 1) {
      const p = base + x;
      if (data[p] > threshold || data[p + pixels] > threshold || data[p + 2 * pixels] > threshold) {
        return false;
      }
    }
    return true;
  };
  let top = 0;
  while (top < height && rowIsBlack(top)) top += 1;
  if (top >= height) return fullContentRect(width, height);
  let bottom = height - 1;
  while (bottom > top && rowIsBlack(bottom)) bottom -= 1;
  const colIsBlack = (x: number): boolean => {
    for (let y = top; y <= bottom; y += 1) {
      const p = y * width + x;
      if (data[p] > threshold || data[p + pixels] > threshold || data[p + 2 * pixels] > threshold) {
        return false;
      }
    }
    return true;
  };
  let left = 0;
  while (left < width && colIsBlack(left)) left += 1;
  if (left >= width) return fullContentRect(width, height);
  let right = width - 1;
  while (right > left && colIsBlack(right)) right -= 1;
  return clampRect({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, width, height);
}

/** Copy the rect's rows out of tight RGBA8 into `out` (exactly w*h*4 bytes). */
export function cropRgbaRect(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  rect: ContentRect,
  out: Uint8Array,
): Uint8Array {
  if (out.length !== rect.width * rect.height * 4) {
    throw new Error(`cropRgbaRect: out must hold ${rect.width * rect.height * 4} bytes, got ${out.length}.`);
  }
  if (src.length < srcWidth * srcHeight * 4) {
    throw new Error(`cropRgbaRect: src must hold ${srcWidth * srcHeight * 4} bytes, got ${src.length}.`);
  }
  for (let row = 0; row < rect.height; row += 1) {
    const srcOffset = ((rect.y + row) * srcWidth + rect.x) * 4;
    out.set(src.subarray(srcOffset, srcOffset + rect.width * 4), row * rect.width * 4);
  }
  return out;
}

/** Copy the rect's rows out of planar floats into `out` (exactly 3*w*h floats). */
export function cropPlanarRect(
  src: Float32Array,
  srcWidth: number,
  srcHeight: number,
  rect: ContentRect,
  out: Float32Array,
): Float32Array {
  const srcPixels = srcWidth * srcHeight;
  const dstPixels = rect.width * rect.height;
  if (src.length < 3 * srcPixels) {
    throw new Error(`cropPlanarRect: src must hold ${3 * srcPixels} floats, got ${src.length}.`);
  }
  if (out.length !== 3 * dstPixels) {
    throw new Error(`cropPlanarRect: out must hold ${3 * dstPixels} floats, got ${out.length}.`);
  }
  for (let c = 0; c < 3; c += 1) {
    const srcPlane = src.subarray(c * srcPixels, (c + 1) * srcPixels);
    const dstPlane = out.subarray(c * dstPixels, (c + 1) * dstPixels);
    for (let row = 0; row < rect.height; row += 1) {
      const srcOffset = (rect.y + row) * srcWidth + rect.x;
      dstPlane.set(srcPlane.subarray(srcOffset, srcOffset + rect.width), row * rect.width);
    }
  }
  return out;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x === 0 ? 1 : x;
}

/**
 * Snap a detected rect OUTWARD to the transport-target grid so the cropped
 * content maps to integer pixels in the downscaled presentation output.
 *
 * The native host box-averages the 4x content to a proportional target; when
 * the target edges land on fractions of a source pixel, pasting the result
 * back next to integer bar fills would leave 1px seams. Growing the rect to
 * the next grid line only ever adds near-black bar pixels (never cuts
 * content), costs at most one target-pixel row/column of extra inference,
 * and keeps every paste origin integer-exact. No-op when no target is set.
 */
export function snapCropToTargetGrid(
  rect: ContentRect,
  fullWidth: number,
  fullHeight: number,
  targetWidth: number,
  targetHeight: number,
): ContentRect {
  if (targetWidth <= 0 || targetHeight <= 0) return rect;
  const stepX = fullWidth / gcd(fullWidth, targetWidth);
  const stepY = fullHeight / gcd(fullHeight, targetHeight);
  if (stepX <= 1 && stepY <= 1) return rect;
  // The exact-integer grid degenerates when the sides are coprime (e.g.
  // 853 -> 1280: gcd 1, step 853) — the only exact edges are the frame
  // borders, so an outward snap would balloon the crop to the full frame
  // and silently disable cropping. Align an axis only while its grid step
  // is cheap (a step of s adds < s source pixels per edge); otherwise
  // accept the ~1px fractional-target seam the snap exists to avoid.
  const MAX_SNAP_STEP = 4;
  const x0 = stepX <= MAX_SNAP_STEP ? Math.floor(rect.x / stepX) * stepX : rect.x;
  const x1 = stepX <= MAX_SNAP_STEP ? Math.ceil((rect.x + rect.width) / stepX) * stepX : rect.x + rect.width;
  const y0 = stepY <= MAX_SNAP_STEP ? Math.floor(rect.y / stepY) * stepY : rect.y;
  const y1 = stepY <= MAX_SNAP_STEP ? Math.ceil((rect.y + rect.height) / stepY) * stepY : rect.y + rect.height;
  return clampRect({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, fullWidth, fullHeight);
}

/**
 * Verify that the cropped-away bar regions are still black on the current
 * frame. Full scan of the (small-by-construction) bar area every processed
 * frame: ~0.1ms at 480p, and it closes the stale-geometry window to a single
 * frame when bars disappear (scene cut, subtitles fading in over the
 * letterbox — subtitle glyphs are bright, so they veto instantly).
 *
 * Returns true when the crop still holds. On false the caller must fall back
 * to the full frame for THIS frame (a superset is always safe) and reset its
 * tracker so the next detection starts fresh.
 */
export function verifyCropHoldsRgba(
  data: Uint8Array,
  width: number,
  height: number,
  crop: ContentRect,
  threshold = LETTERBOX_BYTE_THRESHOLD,
): boolean {
  const pixelOver = (o: number): boolean =>
    data[o]! > threshold || data[o + 1]! > threshold || data[o + 2]! > threshold;
  for (let y = 0; y < crop.y; y += 1) {
    const base = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixelOver(base + x * 4)) return false;
    }
  }
  for (let y = crop.y + crop.height; y < height; y += 1) {
    const base = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixelOver(base + x * 4)) return false;
    }
  }
  for (let y = crop.y; y < crop.y + crop.height; y += 1) {
    const base = y * width * 4;
    for (let x = 0; x < crop.x; x += 1) {
      if (pixelOver(base + x * 4)) return false;
    }
    for (let x = crop.x + crop.width; x < width; x += 1) {
      if (pixelOver(base + x * 4)) return false;
    }
  }
  return true;
}

/** Planar-float mirror of verifyCropHoldsRgba. */
export function verifyCropHoldsPlanar(
  data: Float32Array,
  width: number,
  height: number,
  crop: ContentRect,
  threshold = LETTERBOX_FLOAT_THRESHOLD,
): boolean {
  const pixels = width * height;
  const pixelOver = (p: number): boolean =>
    data[p]! > threshold || data[p + pixels]! > threshold || data[p + 2 * pixels]! > threshold;
  for (let y = 0; y < crop.y; y += 1) {
    const base = y * width;
    for (let x = 0; x < width; x += 1) {
      if (pixelOver(base + x)) return false;
    }
  }
  for (let y = crop.y + crop.height; y < height; y += 1) {
    const base = y * width;
    for (let x = 0; x < width; x += 1) {
      if (pixelOver(base + x)) return false;
    }
  }
  for (let y = crop.y; y < crop.y + crop.height; y += 1) {
    const base = y * width;
    for (let x = 0; x < crop.x; x += 1) {
      if (pixelOver(base + x)) return false;
    }
    for (let x = crop.x + crop.width; x < width; x += 1) {
      if (pixelOver(base + x)) return false;
    }
  }
  return true;
}

/**
 * Detection cadence + adoption hysteresis for one pipeline instance (frame
 * geometry is fixed per instance, so the tracker holds no dimensions until
 * the first observation).
 *
 * - `poll()` advances one processed frame; true means "run a fresh detection
 *   now" (first frame, then every LETTERBOX_REDETECT_INTERVAL frames).
 * - `observe()` folds a fresh detection into the active rect and returns it.
 * - `current()` returns the active rect (full frame until observed otherwise).
 */
export class LetterboxTracker {
  private framesSinceDetect = LETTERBOX_REDETECT_INTERVAL;
  private active: ContentRect | null = null;
  private pending: ContentRect | null = null;
  private pendingConfirmations = 0;

  /** Advance one processed frame; true when the caller should detect now. */
  poll(): boolean {
    this.framesSinceDetect += 1;
    if (this.framesSinceDetect >= LETTERBOX_REDETECT_INTERVAL) {
      this.framesSinceDetect = 0;
      return true;
    }
    return false;
  }

  current(fullWidth: number, fullHeight: number): ContentRect {
    return this.active ?? fullContentRect(fullWidth, fullHeight);
  }

  observe(detected: ContentRect, fullWidth: number, fullHeight: number): ContentRect {
    const active = this.active ?? fullContentRect(fullWidth, fullHeight);
    const clean = clampRect(detected, fullWidth, fullHeight);
    if (rectEquals(clean, active)) {
      this.pending = null;
      this.pendingConfirmations = 0;
      return active;
    }
    // Growing (bars shrank, scene cut): inferring more can never lose
    // content, so adopt immediately.
    if (rectCovers(clean, active)) {
      this.active = clean;
      this.pending = null;
      this.pendingConfirmations = 0;
      return clean;
    }
    // Shrinking or shifting would cut pixels we currently infer: believe it
    // only after consecutive identical detections.
    if (this.pending && rectEquals(this.pending, clean)) {
      this.pendingConfirmations += 1;
    } else {
      this.pending = clean;
      this.pendingConfirmations = 1;
    }
    if (this.pendingConfirmations >= LETTERBOX_SHRINK_CONFIRMATIONS
      && this.worthCropping(clean, fullWidth, fullHeight)) {
      this.active = clean;
      this.pending = null;
      this.pendingConfirmations = 0;
      return clean;
    }
    return active;
  }

  private worthCropping(rect: ContentRect, fullWidth: number, fullHeight: number): boolean {
    if (rect.width < LETTERBOX_MIN_CONTENT_DIM || rect.height < LETTERBOX_MIN_CONTENT_DIM) return false;
    return savedFraction(rect, fullWidth, fullHeight) >= LETTERBOX_MIN_SAVED_FRAC;
  }

  reset(): void {
    this.framesSinceDetect = LETTERBOX_REDETECT_INTERVAL;
    this.active = null;
    this.pending = null;
    this.pendingConfirmations = 0;
  }
}
