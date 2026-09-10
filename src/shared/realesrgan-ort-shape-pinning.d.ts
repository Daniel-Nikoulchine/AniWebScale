/** Types for the canonical ORT shape-pinning module (see realesrgan-ort-shape-pinning.js). */
// Type alias (not interface): ORT's SessionOptions wants
// `{ readonly [dimensionName: string]: number }`, and an interface without
// an index signature is not assignable to it.
export type FreeDimensionOverrides = {
  batch_size: number;
  height: number;
  width: number;
  out_batch_size: number;
  out_height: number;
  out_width: number;
  readonly [dimensionName: string]: number;
};

export interface OrtShapeSpec {
  /** Inference input batch (1 for sessions, tile count for batched runs). */
  batchSize: number;
  height: number;
  width: number;
  /** Model output dims for this input (4x for RealESRGAN). */
  outHeight: number;
  outWidth: number;
}

export declare function buildFreeDimensionOverrides(options: OrtShapeSpec): FreeDimensionOverrides;
