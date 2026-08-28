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

  constructor(private readonly maxPerSize = 2) {}

  /** An ArrayBuffer of exactly `byteLength`, reused from the pool when available. */
  acquire(byteLength: number): ArrayBuffer {
    const list = this.buffers.get(byteLength);
    return list?.pop() ?? new ArrayBuffer(byteLength);
  }

  /** Return a buffer for reuse. Buffers beyond the per-size cap are dropped. */
  release(buffer: ArrayBuffer): void {
    const list = this.buffers.get(buffer.byteLength);
    if (list) {
      if (list.length < this.maxPerSize) list.push(buffer);
      return;
    }
    if (this.maxPerSize > 0) this.buffers.set(buffer.byteLength, [buffer]);
  }

  /** Number of buffers currently held, across all sizes. */
  get pooledCount(): number {
    let count = 0;
    for (const list of this.buffers.values()) count += list.length;
    return count;
  }

  clear(): void {
    this.buffers.clear();
  }
}
