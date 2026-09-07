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
 */
export function decodeFloat16(bits: number): number {
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
  const result = out ?? new Uint8Array(width * height * 4);
  if (format === 'rgba8unorm') {
    for (let row = 0; row < height; row += 1) {
      const src = row * bytesPerRow;
      const dst = row * width * 4;
      result.set(padded.subarray(src, src + width * 4), dst);
    }
    return result;
  }
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const srcByte = row * bytesPerRow + col * 8;
      const dstByte = (row * width + col) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const bits = view.getUint16(srcByte + channel * 2, true);
        const value = decodeFloat16(bits);
        // Video pixels never legitimately sit outside [0,1]; saturate so
        // inf/NaN from a corrupt texture can't poison the model input.
        const clamped = Number.isNaN(value) ? 1 : Math.min(1, Math.max(0, value));
        result[dstByte + channel] = Math.round(clamped * 255);
      }
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
  const data = out ?? new Float32Array(3 * pixels);
  if (data.length !== 3 * pixels) {
    throw new Error(`unpackReadbackToPlanarRgb: out buffer must hold ${3 * pixels} floats, got ${data.length}.`);
  }
  const r = data.subarray(0, pixels);
  const g = data.subarray(pixels, 2 * pixels);
  const b = data.subarray(2 * pixels, 3 * pixels);

  if (format === 'rgba8unorm') {
    for (let row = 0; row < height; row += 1) {
      const srcBase = row * bytesPerRow;
      const dstBase = row * width;
      for (let col = 0; col < width; col += 1) {
        const o = srcBase + col * 4;
        const p = dstBase + col;
        r[p] = padded[o] / 255;
        g[p] = padded[o + 1] / 255;
        b[p] = padded[o + 2] / 255;
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
      // Same saturation rule as unpackReadback: NaN -> 1, clamp to [0,1].
      // Quantising through 8-bit first keeps the result bit-identical to the
      // two-step chain (round(v*255)/255), which the tests pin down.
      for (let channel = 0; channel < 3; channel += 1) {
        const bits = view.getUint16(o + channel * 2, true);
        const value = decodeFloat16(bits);
        const clamped = Number.isNaN(value) ? 1 : Math.min(1, Math.max(0, value));
        const quantised = Math.round(clamped * 255) / 255;
        if (channel === 0) r[p] = quantised;
        else if (channel === 1) g[p] = quantised;
        else b[p] = quantised;
      }
    }
  }
  return { data, channels: 3 };
}
