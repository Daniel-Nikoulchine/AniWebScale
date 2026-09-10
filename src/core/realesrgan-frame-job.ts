import type { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';

export interface RealEsrganFrameJob<TCapture, TResult> {
  frame: number;
  capture: () => Promise<TCapture>;
  infer: (capture: TCapture) => Promise<TResult>;
}

/**
 * Serializes latest-frame-wins jobs and keeps stale-result handling in one
 * place. Up to `depth` jobs run concurrently (Hebel 2.4: 2 on the native
 * path so upload N+1 overlaps compute N; 1 everywhere else). Anything beyond
 * is skipped and counted. The scheduler remains the policy adapter; this
 * module owns the orchestration invariant and is intentionally independent
 * of WebGPU/ORT.
 *
 * One newest-wins gate lives here: `claimPresentation` grants the right to
 * touch a presented output — the monotonic watermark over what has actually
 * been PRESENTED. Right for callers that present out-of-band (the pipeline
 * writes its output texture inside infer()): an older result landing late can
 * never paint over a newer one, while an older-but-newest-completed result
 * still presents (dropping it would hold an even older frame on the canvas).
 */
export class RealEsrganFrameJobRunner<TCapture, TResult> {
  /**
   * Newest frame whose result was allowed to present (see claimPresentation).
   * In-flight accounting is owned by the scheduler (`shouldProcess` gates on
   * its `inFlight` set); a second local counter would only be able to drift.
   */
  private presentedFrame = -1;

  constructor(private readonly scheduler: RealEsrganFrameScheduler) {}

  public submit(job: RealEsrganFrameJob<TCapture, TResult>, depth = 1): boolean {
    const slots = Math.max(1, Math.floor(depth));
    if (!this.scheduler.shouldProcess(job.frame, slots)) {
      this.scheduler.noteSkipped(job.frame);
      return false;
    }

    this.scheduler.markStarted(job.frame);
    void this.execute(job);
    return true;
  }

  /**
   * Claim the output for `frame`. Synchronous (atomic on the JS thread) so
   * two drains racing to present cannot interleave: exactly the newest
   * completed frame wins.
   */
  public claimPresentation(frame: number): boolean {
    if (frame <= this.presentedFrame) return false;
    this.presentedFrame = frame;
    return true;
  }

  /** Record a frame that arrived but was not processed (scheduler delegation). */
  public noteSkipped(frame: number): void {
    this.scheduler.noteSkipped(frame);
  }

  /** Newest submitted-but-unfinished frame, or -1 when idle. */
  public newestInFlightFrame(): number {
    return this.scheduler.newestInFlightFrame();
  }

  /** True when `frame` trails the newest in-flight work by more than `threshold`. */
  public shouldStaleSkip(frame: number, threshold: number): boolean {
    return this.scheduler.newestInFlightFrame() - frame > threshold;
  }

  /** Frames that arrived but were never processed because inference was busy. */
  public get skippedFrames(): number {
    return this.scheduler.skippedFrames;
  }

  public reset(): void {
    this.presentedFrame = -1;
    this.scheduler.reset();
  }

  private async execute(job: RealEsrganFrameJob<TCapture, TResult>): Promise<void> {
    try {
      const capture = await job.capture();
      // Result intentionally unused: the drain presents out-of-band through
      // claimPresentation, not through this runner.
      await job.infer(capture);
    } finally {
      this.scheduler.markCompleted(job.frame);
    }
  }
}
