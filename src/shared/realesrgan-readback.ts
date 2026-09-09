/**
 * GPU readback plumbing for the RealESRGAN ONNX inference path.
 *
 * ONNX inference runs on CPU/WASM (or the WebGPU EP), so the current video
 * frame must travel from the GPU texture to a CPU byte array. WebGPU copies
 * pad each row to a 256-byte multiple; this module plans that layout and
 * strips the padding again. 10/12-bit sources live in rgba16float textures
 * and are quantised to 8-bit here, which is what the ONNX model consumes.
 */

export type ReadbackFormat = 'rgba8unorm' | 'rgba16float';

export interface ReadbackPlan {
  /** Row stride in bytes, aligned to WebGPU's 256-byte copy requirement. */
  bytesPerRow: number;
  /** Total buffer size in bytes for the whole copy. */
  byteLength: number;
}

const BYTES_PER_PIXEL: Record<ReadbackFormat, number> = {
  rgba8unorm: 4,
  rgba16float: 8,
};

const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

export function planReadback(
  width: number,
  height: number,
  format: ReadbackFormat,
): ReadbackPlan {
  const bytesPerPixel = BYTES_PER_PIXEL[format];
  if (!bytesPerPixel) throw new Error(`Unsupported readback format: ${format}`);
  const tightRowBytes = width * bytesPerPixel;
  const bytesPerRow = Math.ceil(tightRowBytes / COPY_BYTES_PER_ROW_ALIGNMENT)
    * COPY_BYTES_PER_ROW_ALIGNMENT;
  return { bytesPerRow, byteLength: bytesPerRow * height };
}

/**
 * Upload counterpart to planReadback: row pitch + buffer size for writing a
 * tightly packed RGBA8 image into a texture with writeTexture. The write
 * side of the copy needs the same 256-byte row alignment as the read side —
 * one planner here, so upload padding is not re-derived per call site.
 */
export function planUpload(width: number, height: number): ReadbackPlan {
  const tightRowBytes = width * 4;
  const bytesPerRow = Math.ceil(tightRowBytes / COPY_BYTES_PER_ROW_ALIGNMENT)
    * COPY_BYTES_PER_ROW_ALIGNMENT;
  return { bytesPerRow, byteLength: bytesPerRow * height };
}

/**
 * Decode an IEEE 754 half-precision bit pattern to a float. Pure decode, no
 * clamping; the caller decides what the video range means for the value.
 *
 * Bulk f16 frames (10/12-bit sources: 3.6M channels at 720p) go through the
 * precomputed tables below instead of this scalar per channel; the tables
 * are built FROM this function, so single lookups and bulk frames agree
 * bit for bit. This wrapper serves the table once built (one array load
 * instead of branches + `2 **` pow), keeping single-call sites fast too.
 */
export function decodeFloat16(bits: number): number {
  const table = ensureF16Tables().f32;
  return table[bits & 0xffff]!;
}

function decodeFloat16Scalar(bits: number): number {
  const sign = (bits & 0x8000) ? -1 : 1;
  const exponent = (bits & 0x7c00) >> 10;
  const mantissa = bits & 0x03ff;
  if (exponent === 0) {
    return sign * mantissa * 2 ** -24; // subnormal
  }
  if (exponent === 0x1f) {
    return mantissa === 0 ? sign * Infinity : NaN;
  }
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}

interface F16Tables {
  /** Raw decode per bit pattern (float64, NaN/Infinity preserved). */
  f32: Float64Array;
  /** Byte-quantised with the unpack saturation rule (NaN -> 1, clamp). */
  u8: Uint8Array;
  /** 8-bit-quantised float for the planar path (round(v*255)/255). */
  qf32: Float32Array;
}

let f16Tables: F16Tables | null = null;

/** Build-once 64k tables from the scalar decoder (bit-identical by construction). */
function ensureF16Tables(): F16Tables {
  if (!f16Tables) {
    const f32 = new Float64Array(65536);
    const u8 = new Uint8Array(65536);
    const qf32 = new Float32Array(65536);
    for (let bits = 0; bits < 65536; bits += 1) {
      const value = decodeFloat16Scalar(bits);
      f32[bits] = value;
      const clamped = Number.isNaN(value) ? 1 : Math.min(1, Math.max(0, value));
      u8[bits] = Math.round(clamped * 255);
      qf32[bits] = Math.round(clamped * 255) / 255;
    }
    f16Tables = { f32, u8, qf32 };
  }
  return f16Tables;
}

/** Byte -> [0,1] float with the exact `/ 255` rounding of the converters. */
let byteToF32Table: Float32Array | null = null;
function ensureByteToF32(): Float32Array {
  if (!byteToF32Table) {
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i += 1) table[i] = i / 255;
    byteToF32Table = table;
  }
  return byteToF32Table;
}

/**
 * Uint16 fast view over the padded bytes when the compartment and alignment
 * allow it (little-endian host, even byteOffset/length). Falls back to null
 * and the caller uses the DataView path — same values, slower.
 */
const IS_LITTLE_ENDIAN: boolean = (() => {
  try {
    const probe = new ArrayBuffer(2);
    new DataView(probe).setUint16(0, 1, true);
    return new Uint16Array(probe)[0] === 1;
  } catch {
    return false;
  }
})();

function uint16ViewOf(padded: Uint8Array): Uint16Array | null {
  try {
    if (!IS_LITTLE_ENDIAN) return null;
    if (padded.byteOffset % 2 !== 0 || padded.byteLength % 2 !== 0) return null;
    return new Uint16Array(padded.buffer, padded.byteOffset, padded.byteLength / 2);
  } catch {
    return null;
  }
}

/**
 * Strip copy padding and return tightly packed RGBA bytes. For rgba16float
 * sources each 16-bit channel is decoded and quantised to 8-bit.
 *
 * `out` is an optional caller-owned buffer (see the buffer pool): when it
 * holds exactly width*height*4 bytes it is filled and returned instead of
 * allocating, so the native fast path avoids one 1.2 MB alloc per frame.
 */
export function unpackReadback(
  padded: Uint8Array,
  width: number,
  height: number,
  format: ReadbackFormat,
  out?: Uint8Array,
): Uint8Array {
  const { bytesPerRow } = planReadback(width, height, format);
  if (out !== undefined && out.length !== width * height * 4) {
    throw new Error(`unpackReadback: out buffer must hold ${width * height * 4} bytes, got ${out.length}.`);
  }
  // A short padded buffer would otherwise unpack silently: the rgba8 row
  // loop copies short subarrays (trailing zeros), the Uint16 path stores
  // table misses as 0, and only the DataView path throws — identical
  // corruption surfacing (or not) by code path. Fail uniformly instead.
  if (padded.byteLength < bytesPerRow * height) {
    throw new Error(`unpackReadback: padded buffer holds ${padded.byteLength} bytes; need ${bytesPerRow * height}.`);
  }
  const result = out ?? new Uint8Array(width * height * 4);
  if (format === 'rgba8unorm') {
    for (let row = 0; row < height; row += 1) {
      const src = row * bytesPerRow;
      const dst = row * width * 4;
      result.set(padded.subarray(src, src + width * 4), dst);
    }
    return result;
  }
  // rgba16float: table-driven (see ensureF16Tables). The Uint16 fast path
  // avoids per-channel DataView bounds/endian overhead; the fallback decodes
  // through the same table so both agree bit for bit.
  const lut = ensureF16Tables().u8;
  const u16 = uint16ViewOf(padded);
  if (u16) {
    const strideU16 = bytesPerRow / 2;
    for (let row = 0; row < height; row += 1) {
      const srcRow = row * strideU16;
      const dstRow = (row * width) * 4;
      for (let col = 0; col < width; col += 1) {
        const srcU = srcRow + col * 4;
        const dstByte = dstRow + col * 4;
        result[dstByte] = lut[u16[srcU]!]!;
        result[dstByte + 1] = lut[u16[srcU + 1]!]!;
        result[dstByte + 2] = lut[u16[srcU + 2]!]!;
        result[dstByte + 3] = lut[u16[srcU + 3]!]!;
      }
    }
    return result;
  }
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const srcByte = row * bytesPerRow + col * 8;
      const dstByte = (row * width + col) * 4;
      result[dstByte] = lut[view.getUint16(srcByte, true)]!;
      result[dstByte + 1] = lut[view.getUint16(srcByte + 2, true)]!;
      result[dstByte + 2] = lut[view.getUint16(srcByte + 4, true)]!;
      result[dstByte + 3] = lut[view.getUint16(srcByte + 6, true)]!;
    }
  }
  return result;
}

/**
 * Copy a WebGPU mapped readback range into `out` (must hold the frame bytes).
 *
 * The range can arrive as a cross-compartment buffer (parent-process shared
 * memory): merely constructing a view on it then throws "Permission denied
 * to access property constructor" in Firefox — the same class
 * rehomeResponseBuffer() handles for fetch bodies. Try the direct
 * zero-copy view first, fall back to a structured clone, and throw only
 * when both fail (the drain counts it and retries the next frame).
 *
 * `viewOf` is an injectable view factory for tests (a hostile buffer cannot
 * be synthesized outside a real multi-compartment browser).
 */
let hostileRangeLogged = false;
export function copyMappedRange(
  range: ArrayBuffer,
  out: Uint8Array,
  viewOf: (buffer: ArrayBuffer, length: number) => Uint8Array = (buffer, length) =>
    new Uint8Array(buffer, 0, length),
): void {
  let view: Uint8Array;
  try {
    view = viewOf(range, out.length);
  } catch {
    // Parent-process shared memory: the plain view throws. Log once (a
    // systematically hostile compartment would otherwise spam one line per
    // frame); the clone below either recovers the frame or throws into the
    // drain's counted retry.
    if (!hostileRangeLogged) {
      hostileRangeLogged = true;
      console.info('[RealESRGAN] readback range hostile; cloning into compartment');
    }
    view = new Uint8Array(structuredClone(range).slice(0, out.length));
  }
  if (view.length !== out.length) {
    throw new Error(`mapped range holds ${view.length} bytes; expected ${out.length}.`);
  }
  out.set(view);
}

export interface PlanarRgbReadback {
  /** Channel-major floats in [0,1], length 3 * width * height. */
  data: Float32Array;
  channels: 3;
}

/**
 * Fused unpack + convert: read the padded GPU copy and write planar RGB
 * floats in [0,1] directly, skipping the intermediate tight RGBA byte array
 * that `unpackReadback` + `rgbaToPlanarRgb` would allocate and walk twice.
 * Output is bit-identical to that two-step chain.
 */
export function unpackReadbackToPlanarRgb(
  padded: Uint8Array,
  width: number,
  height: number,
  format: ReadbackFormat,
  out?: Float32Array,
): PlanarRgbReadback {
  const { bytesPerRow } = planReadback(width, height, format);
  const pixels = width * height;
  if (padded.byteLength < bytesPerRow * height) {
    throw new Error(`unpackReadbackToPlanarRgb: padded buffer holds ${padded.byteLength} bytes; need ${bytesPerRow * height}.`);
  }
  const data = out ?? new Float32Array(3 * pixels);
  if (data.length !== 3 * pixels) {
    throw new Error(`unpackReadbackToPlanarRgb: out buffer must hold ${3 * pixels} floats, got ${data.length}.`);
  }
  const r = data.subarray(0, pixels);
  const g = data.subarray(pixels, 2 * pixels);
  const b = data.subarray(2 * pixels, 3 * pixels);

  if (format === 'rgba8unorm') {
    const byteToF32 = ensureByteToF32();
    for (let row = 0; row < height; row += 1) {
      const srcBase = row * bytesPerRow;
      const dstBase = row * width;
      for (let col = 0; col < width; col += 1) {
        const o = srcBase + col * 4;
        const p = dstBase + col;
        r[p] = byteToF32[padded[o]!]!;
        g[p] = byteToF32[padded[o + 1]!]!;
        b[p] = byteToF32[padded[o + 2]!]!;
      }
    }
    return { data, channels: 3 };
  }

  // f16 planar: quantised table + Uint16 fast path (same saturation rule as
  // unpackReadback: NaN -> 1, clamp to [0,1], quantised through 8-bit first
  // so the result stays bit-identical to the two-step chain).
  const qlut = ensureF16Tables().qf32;
  const u16 = uint16ViewOf(padded);
  if (u16) {
    const strideU16 = bytesPerRow / 2;
    for (let row = 0; row < height; row += 1) {
      const srcRow = row * strideU16;
      const dstBase = row * width;
      for (let col = 0; col < width; col += 1) {
        const srcU = srcRow + col * 4;
        const p = dstBase + col;
        r[p] = qlut[u16[srcU]!]!;
        g[p] = qlut[u16[srcU + 1]!]!;
        b[p] = qlut[u16[srcU + 2]!]!;
      }
    }
    return { data, channels: 3 };
  }

  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  for (let row = 0; row < height; row += 1) {
    const srcBase = row * bytesPerRow;
    const dstBase = row * width;
    for (let col = 0; col < width; col += 1) {
      const o = srcBase + col * 8;
      const p = dstBase + col;
      r[p] = qlut[view.getUint16(o, true)]!;
      g[p] = qlut[view.getUint16(o + 2, true)]!;
      b[p] = qlut[view.getUint16(o + 4, true)]!;
    }
  }
  return { data, channels: 3 };
}
