/**
 * Type declarations for the plain-JS inference worker, for tests and tooling
 * only. The worker itself is shipped unbundled and stays dependency-free JS;
 * this file is never imported at runtime.
 */
export declare function planUniformTiles(
  width: number,
  height: number,
  maxTileSize: number,
  overlap: number,
  singleTileMaxHeight: number,
): Array<{ x: number; y: number; width: number; height: number }>;

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

export declare function composeTilesToRgba8(
  tiles: Array<{ x: number; y: number; width: number; height: number; rgb: Float32Array }>,
  outWidth: number,
  outHeight: number,
  featherWindow: number,
): Uint8Array;

export declare function rewriteF16Bitcast(code: string): string;

export declare function handleInit(message: { type: 'init'; ortUrl: string; wasmDir: string }): Promise<void>;

export declare function handleInfer(message: {
  type: 'infer';
  id: number;
  modelUrl: string;
  modelUrlFp16: string | null;
  width: number;
  height: number;
  data: Float32Array;
  targetWidth?: number;
  targetHeight?: number;
}): Promise<void>;

export declare function resetWorkerStateForTests(): void;

export declare function __setSessionCreateTimeoutForTests(ms: number): void;

export declare function __setOrtLoaderForTests(
  loader: ((url: string) => Promise<unknown>) | null,
): void;
