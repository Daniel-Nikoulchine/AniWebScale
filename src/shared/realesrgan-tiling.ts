/**
 * Tile planning for the RealESRGAN ONNX inference path.
 *
 * Sources up to `singleTileMaxHeight` are processed whole. Larger sources are
 * split into overlapping tiles so each inference call stays within the
 * `maxTileSize` bound required by the fixed-shape ONNX session. Overlap gives
 * the compositor room to feather tile borders away.
 */

export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TilePlanOptions {
  /** Maximum width/height of a single inference tile, in source pixels. */
  maxTileSize: number;
  /** Minimum overlap between neighbouring tiles, in source pixels. */
  overlap: number;
  /** Sources at or below this height are processed as one whole frame. */
  singleTileMaxHeight: number;
}

export interface TilePlan {
  sourceWidth: number;
  sourceHeight: number;
  tiles: Tile[];
}

function tileAxis(size: number, maxTile: number, overlap: number): number[] {
  if (size <= maxTile) return [0];
  const stride = maxTile - overlap;
  const positions: number[] = [];
  let position = 0;
  while (position + maxTile < size) {
    positions.push(position);
    position += stride;
  }
  positions.push(size - maxTile);
  return positions;
}

export function planRealEsrganTiles(
  sourceWidth: number,
  sourceHeight: number,
  options: TilePlanOptions,
): TilePlan {
  if (!Number.isInteger(sourceWidth) || sourceWidth <= 0) {
    throw new Error(`Invalid source width: ${sourceWidth}`);
  }
  if (!Number.isInteger(sourceHeight) || sourceHeight <= 0) {
    throw new Error(`Invalid source height: ${sourceHeight}`);
  }
  if (!Number.isInteger(options.maxTileSize) || options.maxTileSize <= 0) {
    throw new Error(`Invalid maxTileSize: ${options.maxTileSize}`);
  }
  if (!Number.isInteger(options.overlap) || options.overlap < 0 || options.overlap >= options.maxTileSize) {
    throw new Error(`Invalid overlap: ${options.overlap} for maxTileSize ${options.maxTileSize}`);
  }

  if (sourceHeight <= options.singleTileMaxHeight) {
    return {
      sourceWidth,
      sourceHeight,
      tiles: [{ x: 0, y: 0, width: sourceWidth, height: sourceHeight }],
    };
  }

  const xs = tileAxis(sourceWidth, options.maxTileSize, options.overlap);
  const ys = tileAxis(sourceHeight, options.maxTileSize, options.overlap);
  const tiles: Tile[] = [];
  for (const y of ys) {
    for (const x of xs) {
      tiles.push({
        x,
        y,
        width: Math.min(options.maxTileSize, sourceWidth - x),
        height: Math.min(options.maxTileSize, sourceHeight - y),
      });
    }
  }
  return { sourceWidth, sourceHeight, tiles };
}
