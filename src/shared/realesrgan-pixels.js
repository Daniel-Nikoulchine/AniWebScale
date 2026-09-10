/**
 * Canonical zero-import pixel helpers shared by the RealESRGAN tensor
 * plumbing, the GPU readback, and (via the generator) the import-free
 * inference worker.
 *
 * `scripts/generate-worker-tiling.mjs` copies the marked region verbatim into
 * `src/worker/realesrgan-inference-worker.js` (`<generated-pixels>`), so the
 * worker and the main-thread modules share one endianness probe, one
 * byte->float LUT and one RGBA8 word-packing rule. Never edit the worker copy
 * by hand; run `npm run generate:presets` and let `npm run check:presets`
 * catch drift.
 *
 * Types for TypeScript importers live in realesrgan-pixels.d.ts.
 */

// <pixels-begin>
/**
 * Little-endian probe. The RGBA8 pack loops store one 32-bit word per pixel
 * (four byte stores collapsed), which only reproduces the byte-lane result on
 * a little-endian host; big-endian callers fall back to the byte loop.
 */
export const isLittleEndian = (() => {
  try {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 1, true);
    return new Uint16Array(probe)[0] === 1;
  } catch {
    return false;
  }
})();

/** Byte -> [0,1] float with the exact `/ 255` rounding of the converters. */
let byteToF32Table = null;
export function ensureByteToF32() {
  if (!byteToF32Table) {
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i += 1) table[i] = i / 255;
    byteToF32Table = table;
  }
  return byteToF32Table;
}

/**
 * Uint32 view over an RGBA8 byte target for the pack loops: one 32-bit store
 * per pixel instead of four byte stores. Requires little-endian and a
 * 4-aligned view; callers fall back to the byte loop when this returns null.
 * `length` is in u32 elements; when omitted it views the whole buffer and
 * requires a 4-byte-multiple byteLength.
 */
export function packedRgbaView(bytes, length) {
  try {
    if (!isLittleEndian || bytes.byteOffset % 4 !== 0) return null;
    if (length === undefined) {
      if (bytes.byteLength % 4 !== 0) return null;
      length = bytes.byteLength >>> 2;
    }
    return new Uint32Array(bytes.buffer, bytes.byteOffset, length);
  } catch {
    return null;
  }
}

/** Pack one RGBA pixel into a little-endian u32 word (alpha forced opaque). */
export function packRgbaWord(r, g, b) {
  return (r | (g << 8) | (b << 16) | 0xff000000) >>> 0;
}
// <pixels-end>
