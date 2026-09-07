/**
 * Mapping between the registered RealESRGAN pipeline classNames and the ONNX
 * model files bundled with the extension. The file names match the artifacts
 * recorded in models/realesrgan/SOURCE_REVISION.json.
 *
 * Values come from the single asset registry (realesrgan-assets.json);
 * this module keeps the typed names and helpers, never new file names.
 */
import assetRegistry from './realesrgan-assets.json';

export const REALESRGAN_CLASS_TO_MODEL_FILE: Record<string, string> = {
  ...assetRegistry.classToModelFile,
};

/** Optional optimized model. It is used only when the packaged asset exists. */
export const REALESRGAN_CLASS_TO_FP16_MODEL_FILE: Record<string, string> = {
  ...assetRegistry.classToFp16ModelFile,
};

export const REALESRGAN_CLASS_TO_INT8_MODEL_FILE: Record<string, string> = {
  ...assetRegistry.classToInt8ModelFile,
};

/**
 * Hebel 2.1: exact-shape fp32 static variants (built by
 * scripts/build-realesrgan-static.mjs, git-ignored build artifacts). Shapes
 * are inference WxH for the common uncropped playback geometries (16:9 at
 * the three cap presets + 4:3@480). Sourced from the asset registry, so the
 * builder and the runtime cannot drift — the old sync test pins the values.
 */
export interface RealEsrganStaticShape {
  width: number;
  height: number;
  file: string;
}

export const REALESRGAN_STATIC_SHAPES: ReadonlyArray<RealEsrganStaticShape> =
  assetRegistry.staticShapes.map(shape => ({ ...shape }));

/** Static file for an exact inference shape, or null (dynamic fallback). */
export function realEsrganStaticModelFileForShape(width: number, height: number): string | null {
  const hit = REALESRGAN_STATIC_SHAPES.find(shape => shape.width === width && shape.height === height);
  return hit ? hit.file : null;
}

/**
 * Per-frame model URL choice for runner calls: the verified static URL on
 * exact-shape match, else the dynamic model URL. Pure lookup — callers own
 * asset verification (loader HEAD-checks once; session uses modelAssetExists).
 */
export function selectRealEsrganModelUrl(
  modelUrl: string,
  staticUrls: Readonly<Record<string, string>>,
  width: number,
  height: number,
): string {
  return staticUrls[`${width}x${height}`] ?? modelUrl;
}

/** Hebel E5: WASM-SIMD compose module (ships verbatim next to the worker). */
export const REALESRGAN_PIXELS_WASM_CHUNK = 'chunks/pixels.wasm';

export function realEsrganInt8ModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_INT8_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN INT8 pipeline class: ${className}`);
  return file;
}

export function realEsrganFp16ModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_FP16_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN FP16 pipeline class: ${className}`);
  return file;
}

export function realEsrganModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN pipeline class: ${className}`);
  return file;
}
