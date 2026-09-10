/**
 * Still-frame detection for the RealESRGAN path (Hebel 1.4: Paused-Fast-Path).
 *
 * When the video stands still — paused, seek preview, buffering stall — the
 * readback keeps delivering the same frame and every arrival would burn a
 * full inference for a pixel-identical result. x264 dithers every frame of
 * real motion, so exact repeats only ever happen on frozen content (this is
 * also why the tile-hash cache measured 0% hits and stays buried: this is
 * not a cache, it is a stillness gate with no lookups and no memory).
 *
 * Rule: the exact bytes handed to the runner are hashed per processed frame.
 * The third consecutive identical hash holds the presented result and skips
 * inference. Two confirmations (not one) separate a still from a transient
 * duplicate delivery; a hash or geometry change resets immediately, so
 * scrubbing while paused infers every new frame without delay.
 *
 * A wrong hold (hash collision) shows one stale frame and self-heals on the
 * next arrival; FNV-1a over ~75k samples with the 3-consecutive rule makes
 * that unobservable in practice.
 */

/** Sample stride for the frame hash: every Nth byte plus the total length. */
export const STILLFRAME_HASH_STRIDE = 16;
/** Consecutive identical hashes required before inference is held. */
export const STILLFRAME_HOLD_AFTER = 3;

/** FNV-1a 32-bit over sampled bytes; length is mixed in, dims via geometry key. */
export function hashFrameBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += STILLFRAME_HASH_STRIDE) {
    hash ^= bytes[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= bytes.length & 0xff;
  hash = Math.imul(hash, 0x01000193);
  hash ^= (bytes.length >>> 8) & 0xff;
  hash = Math.imul(hash, 0x01000193);
  return hash >>> 0;
}

/**
 * Counts consecutive identical (hash, geometry) observations. `observe`
 * returns the current run length; the caller holds inference once it reaches
 * STILLFRAME_HOLD_AFTER and a result is already presented.
 */
export class StillframeTracker {
  private lastHash: number | null = null;
  private lastGeometry: string | null = null;
  private runLength = 0;

  observe(hash: number, geometryKey: string): number {
    if (hash === this.lastHash && geometryKey === this.lastGeometry) {
      this.runLength += 1;
    } else {
      this.lastHash = hash;
      this.lastGeometry = geometryKey;
      this.runLength = 1;
    }
    return this.runLength;
  }

  reset(): void {
    this.lastHash = null;
    this.lastGeometry = null;
    this.runLength = 0;
  }
}
