/** Types for the canonical tile geometry module (see realesrgan-tile-geometry.js). */
export interface GeometryTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export declare function tileAxis(size: number, maxTile: number, overlap: number): number[];

export declare function defaultSingleTileMaxHeight(
  width: number,
  height: number,
  maxTileSize: number,
): number;

/** Worker-facing alias of defaultSingleTileMaxHeight (same rule, one body). */
export declare const singleTileMaxHeightForFrame: (
  width: number,
  height: number,
  maxTileSize: number,
) => number;

export declare function defaultOverlapFor(maxTileSize: number): number;

export declare function featherWindowForOverlap(overlap: number): number;

export declare function planUniformTiles(
  width: number,
  height: number,
  maxTileSize: number,
  overlap: number,
  singleTileMaxHeight: number,
): GeometryTile[];

export interface WorkerFrameGeometry {
  maxTileSize: number;
  overlap: number;
  singleTileMaxHeight: number;
  tiles: GeometryTile[];
  featherWindow: number;
}

export declare function planWorkerFrame(width: number, height: number): WorkerFrameGeometry;

/** Options for one main-thread tile plan. */
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
  tiles: GeometryTile[];
}

/**
 * Main-thread tiling API (outside the generated worker block): conservative
 * geometry selection + tile planning. Explicit options always win — the
 * main-thread fallback deliberately keeps the 512 gate (weakest devices).
 */
export declare function adaptiveRealEsrganTiling(
  width: number,
  height: number,
  options?: Partial<TilePlanOptions>,
): TilePlanOptions;

export declare function planRealEsrganTiles(
  sourceWidth: number,
  sourceHeight: number,
  options: TilePlanOptions,
): TilePlan;
