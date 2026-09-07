/**
 * Canonical RealESRGAN worker protocol (single source of truth).
 *
 * Plain JavaScript, zero imports: message shapes are shared with the
 * import-free inference worker by convention (it cannot import this file
 * for the Blob-URL load), while TypeScript consumers (worker client,
 * worker .d.ts mirror, tests) import the types from
 * realesrgan-worker-protocol.d.ts. Add a message field here first; the
 * worker's inline handling follows the same names.
 *
 * The builders below are the executable half of that contract: the client
 * and every test fake construct messages through them, so adding a field
 * touches this module plus the worker's inline reads — not a scatter of
 * hand-built literals.
 */

/**
 * Reply guard: true for worker init/infer replies (ok or error shaped).
 * Shared so the client and every test fake validate through one seam.
 */
export function isWorkerReply(value) {
  return typeof value === 'object' && value !== null
    && (value.type === 'init' || value.type === 'infer');
}

/**
 * Canonical error codes on `{ ok: false }` infer replies. The worker
 * inlines these literals (it cannot import this file for the Blob-URL
 * load); the client classifies per code — never by parsing error prose —
 * and the Runner-Guard's transient/permanent policy rides the same codes.
 */
export const WORKER_REPLY_ERROR_CODES = {
  TIMEOUT: 'worker-timeout',
  FAILED: 'worker-failed',
};

/**
 * Build the init message the client sends right after spawning the blob
 * worker. `pixelsUrl` rides along only when a non-empty string — the worker
 * treats its absence as "JS compose only".
 */
export function buildWorkerInitMessage({ ortUrl, wasmDir, pixelsUrl }) {
  const message = { type: 'init', ortUrl, wasmDir };
  if (typeof pixelsUrl === 'string' && pixelsUrl) message.pixelsUrl = pixelsUrl;
  return message;
}

/**
 * Build one infer request. `data` is a transferred planar NCHW Float32Array;
 * `targetWidth/targetHeight` ride along only when both are positive integers
 * — 0/absent means "legacy full 4x frame" (the worker box-averages to a valid
 * target and reports the actual dimensions back).
 */
export function buildWorkerInferMessage({
  id, modelUrl, modelUrlFp16, width, height, data, targetWidth = 0, targetHeight = 0,
}) {
  const message = { type: 'infer', id, modelUrl, modelUrlFp16, width, height, data };
  if (Number.isInteger(targetWidth) && Number.isInteger(targetHeight)
    && targetWidth > 0 && targetHeight > 0) {
    message.targetWidth = targetWidth;
    message.targetHeight = targetHeight;
  }
  return message;
}
