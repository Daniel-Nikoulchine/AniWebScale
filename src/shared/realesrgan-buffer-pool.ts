/**
 * ArrayBuffer pool for the RealESRGAN inference path.
 *
 * Every processed frame walks several full-frame buffers: the readback copy,
 * the planar model input, the tiled accumulator, the weight map, and the
 * padded upload bytes. At 1080p the accumulator alone is over 100 MB.
 * Allocating those fresh every frame hammers the GC and causes pauses in the
 * frame loop. Frame dimensions rarely change within one video, so a pool
 * keyed by exact byte size reuses the same buffers frame after frame.
 *
 * The pool never tracks provenance: releasing a buffer that was not acquired
 * here simply adopts it (bounded by the per-size cap). Buffers handed to the
 * ONNX runtime as tensor backing must NOT be pooled, because the runtime may
 * still read them asynchronously after `run()` resolves; tile extraction
 * buffers therefore stay fresh.
 */
export class RealEsrganBufferPool {
  private readonly buffers = new Map<number, ArrayBuffer[]>();
  private pooledBytes = 0;

  constructor(
    private readonly maxPerSize = 2,
    /**
     * Upper bound on total pooled bytes across every size. The per-size cap
     * alone leaves the pool unbounded as distinct geometries accumulate
     * (crop rectangles, upload row padding): a long session could pin every
     * buffer it ever saw. The cap keeps the hot path allocation-free while
     * refusing to grow past a hard ceiling. Default: unbounded, so existing
     * callers keep their exact reuse behaviour.
     */
    private readonly maxTotalBytes = Number.POSITIVE_INFINITY,
  ) {}

  /** An ArrayBuffer of exactly `byteLength`, reused from the pool when available. */
  acquire(byteLength: number): ArrayBuffer {
    const list = this.buffers.get(byteLength);
    const buffer = list?.pop();
    if (buffer !== undefined) {
      this.pooledBytes -= buffer.byteLength;
      return buffer;
    }
    return new ArrayBuffer(byteLength);
  }

  /** Return a buffer for reuse. Buffers beyond the caps are dropped. */
  release(buffer: ArrayBuffer): void {
    const canPool = this.pooledBytes + buffer.byteLength <= this.maxTotalBytes;
    const list = this.buffers.get(buffer.byteLength);
    if (list) {
      // Single-release ownership: the same buffer must never be pooled
      // twice (two later acquires would alias one ArrayBuffer across two
      // frames and corrupt both). A second release is a caller bug — drop
      // it loudly in spirit (no throw: the frame is already on its way out)
      // by ignoring the duplicate instead of aliasing.
      if (list.includes(buffer)) return;
      if (list.length < this.maxPerSize && canPool) {
        list.push(buffer);
        this.pooledBytes += buffer.byteLength;
      }
      return;
    }
    if (this.maxPerSize > 0 && canPool) {
      this.buffers.set(buffer.byteLength, [buffer]);
      this.pooledBytes += buffer.byteLength;
    }
  }

  /** Number of buffers currently held, across all sizes. */
  get pooledCount(): number {
    let count = 0;
    for (const list of this.buffers.values()) count += list.length;
    return count;
  }

  /** Total bytes currently held, across all sizes. */
  get pooledByteLength(): number {
    return this.pooledBytes;
  }

  clear(): void {
    this.buffers.clear();
    this.pooledBytes = 0;
  }
}
