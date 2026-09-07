/**
 * Canonical ORT shape-pinning for every RealESRGAN session (main-thread
 * fallback AND inference worker).
 *
 * One bug, one fix: onnxruntime-web's WebGPU EP caches its internal output
 * buffer after the first run and hard-fails every later run whose output
 * shape differs ("Shape mismatch attempting to re-use buffer
 * {1,480,640,3} != {1,1920,2560,3}") — even on the SAME session object,
 * and even when the earlier shape was smaller. The validator compares the
 * NHWC input shape against the output shape regardless of dim_param
 * naming. Concrete dims at session-creation time sidestep the symbolic-dim
 * path entirely; the caches on both sides are shape-pinned anyway, so the
 * override costs nothing.
 *
 * The `out_*` symbols are pinned DEFENSIVELY: a model that does not declare
 * them ignores the overrides (verified against python ORT 1.29), and a
 * model that does declare them gets the correct 4x output dims. Both
 * consumers used to hand-roll this object — the copies had already drifted
 * (the worker pinned out_*, the session did not) — so the builder below is
 * the one implementation, mirrored into the import-free worker by
 * scripts/generate-worker-tiling.mjs.
 *
 * Cache-key conventions (per consumer, documented once):
 *   - worker `sessions` map: url | fp16Url | batch | inH | inW | outH | outW | gpuBufferFlag
 *   - session factory: `${className}_${width}x${height}` (execution prefs
 *     are fixed per factory instance, so they need no key slot)
 *
 * Plain JavaScript, zero imports (the generated worker copy must parse
 * standalone). Types live in realesrgan-ort-shape-pinning.d.ts.
 */
// <ort-shape-pinning-begin>

/**
 * Free-dimension overrides pinning ONE exact I/O shape. `outHeight` /
 * `outWidth` are the model's output dims for that input (4x for RealESRGAN).
 */
export function buildFreeDimensionOverrides(options) {
  return {
    batch_size: options.batchSize,
    height: options.height,
    width: options.width,
    out_batch_size: options.batchSize,
    out_height: options.outHeight,
    out_width: options.outWidth,
  };
}
// <ort-shape-pinning-end>
