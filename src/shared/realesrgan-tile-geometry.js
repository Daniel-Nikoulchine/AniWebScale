/**
 * Canonical tile geometry for the RealESRGAN path (single source of truth).
 *
 * Plain JavaScript, zero imports: the inference worker stays import-free for
 * the Blob-URL load, so `scripts/generate-worker-tiling.mjs` copies this
 * file's marked region verbatim into
 * `src/worker/realesrgan-inference-worker.js` (markers
 * `<generated-tile-geometry>`). Never edit the worker copy by hand; run
 * `npm run generate:presets` (or the generator directly) instead.
 * `npm run check:presets` fails on drift.
 *
 * Types for TypeScript importers live in realesrgan-tile-geometry.d.ts.
 */

// <tile-geometry-begin>
/**
 * Positions along one axis: maxTile-wide entries stepping by
 * (maxTile - overlap), last position clamped to size - maxTile.
 */
export function tileAxis(size, maxTile, overlap) {
  if (size <= maxTile) return [0];
  const stride = maxTile - overlap;
  const positions = [];
  let position = 0;
  while (position + maxTile < size) {
    positions.push(position);
    position += stride;
  }
  positions.push(size - maxTile);
  return positions;
}

/**
 * Default single-tile gate for a frame (Hebel 1.2): frames that fit a
 * bounded transient (<= 1024x576 pixels, +35% over the 480p cap the browser
 * already runs single-tile) run as one inference instead of two
 * ~fully-overlapping tiles at ~2x cost. Wider frames keep the tile-size
 * gate so large inputs cannot blow the transient budget.
 */
export function defaultSingleTileMaxHeight(width, height, maxTileSize) {
  if (maxTileSize >= 512 && width * height <= 1024 * 576) return 576;
  return Math.min(576, maxTileSize);
}

/**
 * Worker-facing alias: the generated worker copy historically exports this
 * name (bench, tests and the infer path import it). Same rule, one body.
 */
export const singleTileMaxHeightForFrame = defaultSingleTileMaxHeight;

/** Default overlap for a tile size: 24px for both real geometries. */
export function defaultOverlapFor(maxTileSize) {
  return Math.min(24, Math.floor(maxTileSize / 16));
}

/** Feather window the compositor needs for an overlap (output pixels). */
export function featherWindowForOverlap(overlap) {
  return Math.max(1, overlap * 2);
}

/**
 * Tile plan for one frame. Every produced tile has the same stepping rule;
 * uniform tiles are what makes one batched session.run legal for the whole
 * frame. Sources at or below singleTileMaxHeight run whole.
 */
export function planUniformTiles(width, height, maxTileSize, overlap, singleTileMaxHeight) {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Invalid source width: ${width}`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid source height: ${height}`);
  }
  if (!Number.isInteger(maxTileSize) || maxTileSize <= 0) {
    throw new Error(`Invalid maxTileSize: ${maxTileSize}`);
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxTileSize) {
    throw new Error(`Invalid overlap: ${overlap} for maxTileSize ${maxTileSize}`);
  }
  if (!Number.isInteger(singleTileMaxHeight) || singleTileMaxHeight <= 0) {
    throw new Error(`Invalid singleTileMaxHeight: ${singleTileMaxHeight}`);
  }
  if (height <= singleTileMaxHeight) {
    return [{ x: 0, y: 0, width, height }];
  }
  const positions = (size) => tileAxis(size, maxTileSize, overlap);
  const tiles = [];
  for (const y of positions(height)) {
    for (const x of positions(width)) {
      tiles.push({
        x,
        y,
        width: Math.min(maxTileSize, width - x),
        height: Math.min(maxTileSize, height - y),
      });
    }
  }
  return tiles;
}

/**
 * Complete worker frame geometry: tile size bound, overlap, single-tile
 * gate, tile list and feather window. One call replaces the scattered
 * 384/512 + 24 + gate + 48 literals at the worker call site.
 */
export function planWorkerFrame(width, height) {
  const maxTileSize = width * height >= 1920 * 1080 ? 384 : 512;
  const overlap = defaultOverlapFor(maxTileSize);
  const singleTileMaxHeight = defaultSingleTileMaxHeight(width, height, maxTileSize);
  return {
    maxTileSize,
    overlap,
    singleTileMaxHeight,
    tiles: planUniformTiles(width, height, maxTileSize, overlap, singleTileMaxHeight),
    featherWindow: featherWindowForOverlap(overlap),
  };
}
// <tile-geometry-end>
// <main-thread-tiling-api>
// The functions below serve the MAIN-THREAD paths only (pipeline fallback and
// tensor planning). They deliberately live outside the generated worker
// markers: the worker plans with planWorkerFrame() above and must not carry
// this API. One geometry module, one policy, two consumers.

/**
 * Options for one tile plan. Explicit options always win: the main-thread
 * fallback path deliberately keeps 512 (weakest devices, no E2E for more),
 * while the worker takes Hebel 1.2's bounded 576 gate via planWorkerFrame().
 */

/**
 * Select conservative tile geometry for the current input. Larger tiles reduce
 * per-tile ORT/message overhead; smaller tiles avoid large transient tensors.
 *
 * Hebel 1.2 single-tile guarantee: the default single-tile gate is 576 (not
 * the tile size) for frames that fit a bounded transient (<= 1024x576
 * pixels, +35% over the 480p cap the browser already runs single-tile), so
 * frames just over the old 512 gate (e.g. 960x540) stop tiling into two
 * ~fully-overlapping tiles at ~2x cost. Wider frames and the 384 geometry
 * keep the tile-size gate so large inputs cannot blow the transient budget.
 */
export function adaptiveRealEsrganTiling(
  width,
  height,
  options = {},
) {
  const pixels = width * height;
  const maxTileSize = options.maxTileSize ?? (pixels >= 1920 * 1080 ? 384 : 512);
  const overlap = options.overlap ?? defaultOverlapFor(maxTileSize);
  return {
    maxTileSize,
    overlap: Math.min(overlap, Math.max(0, maxTileSize - 1)),
    singleTileMaxHeight: options.singleTileMaxHeight ?? defaultSingleTileMaxHeight(width, height, maxTileSize),
  };
}

/**
 * Tile plan for one main-thread frame. Delegates straight to
 * planUniformTiles — whose validation is THE validation (same invariant
 * checks, same messages); no second validation layer on top.
 */
export function planRealEsrganTiles(sourceWidth, sourceHeight, options) {
  return {
    sourceWidth,
    sourceHeight,
    tiles: planUniformTiles(
      sourceWidth,
      sourceHeight,
      options.maxTileSize,
      options.overlap,
      options.singleTileMaxHeight,
    ),
  };
}
// </main-thread-tiling-api>
