/** Canonical pixel-helper types (see realesrgan-pixels.js). */

/** True on little-endian hosts (the u32 pack lanes are valid there). */
export declare const isLittleEndian: boolean;

/** Byte -> [0,1] float LUT (built once, `/ 255`). */
export declare function ensureByteToF32(): Float32Array;

/**
 * Uint32 view over an RGBA8 byte target, or null when the host/alignment
 * forbids it. `length` is in u32 elements; omitted = whole buffer.
 */
export declare function packedRgbaView(bytes: Uint8Array, length?: number): Uint32Array | null;

/** Pack one RGBA pixel into a little-endian u32 word (alpha opaque). */
export declare function packRgbaWord(r: number, g: number, b: number): number;
