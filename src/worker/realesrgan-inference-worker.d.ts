/**
 * Type declarations for the plain-JS inference worker, for tests and tooling
 * only. The worker itself is shipped unbundled and stays dependency-free JS;
 * this file is never imported at runtime.
 *
 * Message and tile shapes live in the canonical modules; this mirror only
 * declares which names the worker exports.
 */
import type { GeometryTile } from '../shared/realesrgan-tile-geometry.js';
import type { WorkerInferMessage, WorkerInitMessage } from '../shared/realesrgan-worker-protocol.js';

export declare function planUniformTiles(
  width: number,
  height: number,
  maxTileSize: number,
  overlap: number,
  singleTileMaxHeight: number,
): GeometryTile[];

export declare function singleTileMaxHeightForFrame(
  width: number,
  height: number,
  maxTileSize: number,
): number;

export declare function tileAxis(size: number, maxTile: number, overlap: number): number[];

export declare function defaultOverlapFor(maxTileSize: number): number;

export declare function featherWindowForOverlap(overlap: number): number;

export declare function planWorkerFrame(width: number, height: number): {
  maxTileSize: number;
  overlap: number;
  singleTileMaxHeight: number;
  tiles: GeometryTile[];
  featherWindow: number;
};

export declare function stackTilesToBatch(
  inputRgb: Float32Array,
  sourceWidth: number,
  sourceHeight: number,
  tiles: Array<{ x: number; y: number; width: number; height: number }>,
): Float32Array;

export declare function splitBatchedOutput(
  batched: Float32Array,
  tiles: Array<{ x: number; y: number; width: number; height: number }>,
): Array<{ x: number; y: number; width: number; height: number; rgb: Float32Array }>;

export declare function composeSingleTileToRgba8(
  rgb: Float32Array,
  width: number,
  height: number,
): Uint8Array;

export declare function composeTilesToRgba8(
  tiles: Array<{ x: number; y: number; width: number; height: number; rgb: Float32Array }>,
  outWidth: number,
  outHeight: number,
  featherWindow: number,
): Uint8Array;

export declare function rewriteF16Bitcast(code: string): string;

export declare function handleInit(message: WorkerInitMessage): Promise<void>;

export declare function handleInfer(message: WorkerInferMessage): Promise<void>;

export declare function __setPixelsLoaderForTests(
  loader: ((url: string) => Promise<unknown>) | null,
): void;

export declare function __setPixelsModuleForTests(mod: unknown): void;

export declare function resetWorkerStateForTests(): void;

export declare function __setSessionCreateTimeoutForTests(ms: number): void;

export declare function __setOrtLoaderForTests(
  loader: ((url: string) => Promise<unknown>) | null,
): void;
