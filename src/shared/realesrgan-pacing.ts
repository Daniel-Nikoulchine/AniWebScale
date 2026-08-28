/**
 * Latest-frame-wins pacing for the RealESRGAN inference path.
 *
 * RealESRGAN inference can take longer than a video frame interval. The video
 * keeps running; this scheduler decides which frame is worth processing and
 * which results are stale. A frame is processed only when no inference is in
 * flight. When a newer frame arrives mid-inference, the in-flight result is
 * marked stale and dropped on completion, and the skipped frames are counted
 * for the stats overlay.
 */
export class RealEsrganFrameScheduler {
  private inFlightFrame: number | null = null;
  private newestSeenFrame = -1;
  private skipped = 0;
  private dropped = 0;

  /** True when no inference is running and this frame may start one. */
  shouldProcess(frameIndex: number): boolean {
    return this.inFlightFrame === null && frameIndex > this.newestSeenFrame;
  }

  /** Mark that inference for `frameIndex` has started. */
  markStarted(frameIndex: number): void {
    this.inFlightFrame = frameIndex;
    if (frameIndex > this.newestSeenFrame) this.newestSeenFrame = frameIndex;
  }

  /** A newer frame arrived from the video while inference may be running. */
  noteNewerFrame(frameIndex: number): void {
    if (frameIndex <= this.newestSeenFrame) return;
    if (this.inFlightFrame !== null && frameIndex > this.inFlightFrame) {
      this.skipped += frameIndex - this.newestSeenFrame;
    }
    this.newestSeenFrame = frameIndex;
  }

  /** True when the result for `frameIndex` is still the newest work. */
  isResultCurrent(frameIndex: number): boolean {
    if (frameIndex < this.newestSeenFrame) {
      this.dropped += 1;
      return false;
    }
    return true;
  }

  /** Mark inference for `frameIndex` as finished. */
  markCompleted(frameIndex: number): void {
    if (this.inFlightFrame === frameIndex) this.inFlightFrame = null;
  }

  /** Frames that arrived but were never processed because inference was busy. */
  get skippedFrames(): number {
    return this.skipped;
  }

  /** Completed results discarded because a newer frame had already arrived. */
  get droppedResults(): number {
    return this.dropped;
  }

  reset(): void {
    this.inFlightFrame = null;
    this.newestSeenFrame = -1;
    this.skipped = 0;
    this.dropped = 0;
  }
}
