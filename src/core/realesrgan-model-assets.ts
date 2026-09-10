/**
 * Modell-Auswahl (model asset selection) for the RealESRGAN runner paths.
 *
 * One module owns "which model file serves this frame": URL resolution for a
 * pipeline class (including the E2E-only file override), one-shot HEAD
 * verification of the packaged static-shape variants, and the per-frame pick
 * (verified static URL on exact shape match, dynamic model otherwise).
 *
 * The Runner seam consumes URLs per frame: the worker adapter is
 * model-agnostic by interface and the native host has its model baked in, so
 * neither adapter knows the asset table. The main-thread session cascade
 * keeps its own asset probing (int8/fp16 ladder) in realesrgan-session.ts —
 * it serves the fallback ladder for a class+shape, not per-frame runner
 * dispatch, and shares the static-shape rule via
 * realEsrganStaticModelFileForShape().
 */
import {
  REALESRGAN_CLASS_TO_MODEL_FILE,
  REALESRGAN_STATIC_SHAPES,
  realEsrganFp16ModelFileForClass,
  selectRealEsrganModelUrl,
} from '../shared/realesrgan-models';
import { E2E_KNOBS } from '../shared/realesrgan-e2e-knobs.js';

/** Storage key of the E2E model-file override, from the canonical knob table. */
const E2E_MODEL_FILE_STORAGE_KEY = E2E_KNOBS.find(knob => knob.env === 'E2E_MODEL_FILE')?.storage ?? 'e2eModelFile';

export interface RealEsrganModelAssets {
  /** Dynamic (symbolic-shape) model URL; the per-frame fallback. */
  readonly dynamicUrl: string;
  /**
   * FP16 variant URL for worker-backed runners, or null. Always resolved
   * when the packaged asset verifies (one HEAD per class, cached with the
   * assets); the PIPELINE gates it by the selected precision and hands the
   * worker null for fp32/int8, so the dead RDNA2 fp16 probe only runs when
   * the user actually picked fp16. Null under the E2E model-file override
   * (statics and fp16 belong to the base model, not the override).
   */
  readonly fp16Url: string | null;
  /** Per-frame pick: verified static URL on exact shape, dynamic otherwise. */
  urlForShape(width: number, height: number): string;
}

export interface RealEsrganModelAssetsOptions {
  /** Resolve an extension-relative path to a fetchable URL. */
  resolveUrl: (path: string) => string;
  /**
   * Verify an asset URL exists (production: HEAD request). Absent assets
   * simply stay out of the static table — verification failure is never
   * fatal, the dynamic model serves those shapes.
   */
  verifyAsset?: (url: string) => Promise<boolean>;
  /** E2E-only: read one storage key (the caller guards the E2E flag). */
  readStorageKey?: (key: string) => Promise<unknown>;
  /**
   * FP16 variant URL handed to worker-backed runners. An explicit value
   * (including null) wins, so tests and E2E can pin the worker input; when
   * absent the packaged fp16 asset is resolved and verified like the static
   * shapes. The pipeline still gates it by the selected precision.
   */
  fp16Url?: string | null;
}

async function headVerify(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load the model assets for one RealESRGAN pipeline class. Resolves the
 * dynamic URL, HEAD-verifies every packaged static-shape variant once
 * (missing assets degrade to the dynamic model), and honours the E2E-only
 * model-file override. Unknown class names throw: the asset registry is the
 * source of truth and a typo must fail loudly at load, not per frame.
 */
export async function loadRealEsrganModelAssets(
  className: string,
  options: RealEsrganModelAssetsOptions,
): Promise<RealEsrganModelAssets> {
  const baseFile = REALESRGAN_CLASS_TO_MODEL_FILE[className];
  if (!baseFile) throw new Error(`Unknown RealESRGAN pipeline class: ${className}`);

  let modelFile = baseFile;
  const readStorageKey = options.readStorageKey;
  if (typeof __ANIME4K_E2E__ !== 'undefined' && __ANIME4K_E2E__ && readStorageKey) {
    try {
      const stored = await readStorageKey(E2E_MODEL_FILE_STORAGE_KEY);
      if (typeof stored === 'string' && stored) modelFile = stored;
    } catch { /* storage unavailable */ }
  }

  const dynamicUrl = options.resolveUrl(`models/realesrgan/${modelFile}`);
  const staticUrls: Record<string, string> = {};
  const verify = options.verifyAsset ?? headVerify;
  await Promise.all(REALESRGAN_STATIC_SHAPES.map(async ({ width, height, file }) => {
    // The E2E override replaces the whole model file; static variants are
    // built from the base model and would mislead the clip runner.
    if (modelFile !== baseFile) return;
    const url = options.resolveUrl(`models/realesrgan/${file}`);
    if (await verify(url)) staticUrls[`${width}x${height}`] = url;
  }));

  // FP16 worker input: explicit option wins (tests/E2E pin it, including
  // null); otherwise resolve the packaged asset, verified like the statics.
  // Absent under the E2E override, same reason as the statics above.
  let fp16Url: string | null = options.fp16Url !== undefined ? options.fp16Url : null;
  if (options.fp16Url === undefined && modelFile === baseFile) {
    const fp16File = realEsrganFp16ModelFileForClass(className);
    const url = options.resolveUrl(`models/realesrgan/${fp16File}`);
    if (await verify(url)) fp16Url = url;
  }

  return {
    dynamicUrl,
    fp16Url,
    urlForShape: (width: number, height: number) =>
      selectRealEsrganModelUrl(dynamicUrl, staticUrls, width, height),
  };
}
