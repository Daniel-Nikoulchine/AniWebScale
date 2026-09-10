/**
 * Latest-frame-wins pacing for the RealESRGAN inference path.
 *
 * RealESRGAN inference can take longer than a video frame interval. The video
 * keeps running; this scheduler decides which frame is worth processing and
 * tracks the newest-seen work. A frame is processed only when fewer
 * than `depth` inferences are in flight (Hebel 2.4: depth 2 on the native path
 * so upload N+1 overlaps compute N; 1 everywhere else). When no slot is free,
 * newly arriving frames are skipped and counted for the stats overlay.
 */
export class RealEsrganFrameScheduler {
  private readonly inFlight = new Set<number>();
  private newestSeenFrame = -1;
  private skipped = 0;

  /** True when a slot below `depth` is free and this frame is new. */
  shouldProcess(frameIndex: number, depth = 1): boolean {
    return this.inFlight.size < Math.max(1, Math.floor(depth))
      && frameIndex > this.newestSeenFrame;
  }

  /** Mark that inference for `frameIndex` has started. */
  markStarted(frameIndex: number): void {
    this.inFlight.add(frameIndex);
    if (frameIndex > this.newestSeenFrame) this.newestSeenFrame = frameIndex;
  }

  /**
   * A frame arrived that will NOT be processed (no free slot). Counts the
   * gap since the last seen frame while work is in flight. Call only on the
   * skip path: processed frames go through markStarted(), which never
   * counts — otherwise a depth-2 start would bill itself as skipped.
   */
  noteSkipped(frameIndex: number): void {
    if (frameIndex <= this.newestSeenFrame) return;
    if (this.inFlight.size > 0) {
      this.skipped += frameIndex - this.newestSeenFrame;
    }
    this.newestSeenFrame = frameIndex;
  }

  /** Mark inference for `frameIndex` as finished. */
  markCompleted(frameIndex: number): void {
    this.inFlight.delete(frameIndex);
  }

  /**
   * Newest submitted-but-unfinished frame, or -1 when idle. Lets the
   * pipeline skip fetching a frame that newer in-flight work has already
   * made redundant (stale-skip), instead of burning serial host time on
   * bytes claimPresentation would drop anyway.
   */
  newestInFlightFrame(): number {
    let newest = -1;
    for (const frame of this.inFlight) {
      if (frame > newest) newest = frame;
    }
    return newest;
  }

  /** Frames that arrived but were never processed because inference was busy. */
  get skippedFrames(): number {
    return this.skipped;
  }

  reset(): void {
    this.inFlight.clear();
    this.newestSeenFrame = -1;
    this.skipped = 0;
  }
}
