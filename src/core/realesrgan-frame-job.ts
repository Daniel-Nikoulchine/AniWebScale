import type { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';

export interface RealEsrganFrameJob<TCapture, TResult> {
  frame: number;
  capture: () => Promise<TCapture>;
  infer: (capture: TCapture) => Promise<TResult>;
  publish: (result: TResult) => void;
}

/**
 * Serializes latest-frame-wins jobs and keeps stale-result handling in one
 * place. Up to `depth` jobs run concurrently (Hebel 2.4: 2 on the native
 * path so upload N+1 overlaps compute N; 1 everywhere else). Anything beyond
 * is skipped and counted. The scheduler remains the policy adapter; this
 * module owns the orchestration invariant and is intentionally independent
 * of WebGPU/ORT.
 *
 * Two newest-wins questions live here, and they are DIFFERENT questions:
 * - `publish` fires only while a result is still the newest SUBMITTED work
 *   (the job gate). Right for callers whose publish is record keeping.
 * - `claimPresentation` grants the right to touch a presented output — the
 *   monotonic watermark over what has actually been PRESENTED. Right for
 *   callers that present out-of-band (the pipeline writes its output
 *   texture inside infer()): an older result landing late can never paint
 *   over a newer one, while an older-but-newest-completed result still
 *   presents (dropping it would hold an even older frame on the canvas).
 */
export class RealEsrganFrameJobRunner<TCapture, TResult> {
  private activeCount = 0;
  private newestFrame = -1;
  /** Newest frame whose result was allowed to present (see claimPresentation). */
  private presentedFrame = -1;

  constructor(private readonly scheduler: RealEsrganFrameScheduler) {}

  public submit(job: RealEsrganFrameJob<TCapture, TResult>, depth = 1): boolean {
    const slots = Math.max(1, Math.floor(depth));
    this.newestFrame = Math.max(this.newestFrame, job.frame);
    if (this.activeCount >= slots || !this.scheduler.shouldProcess(job.frame, slots)) {
      this.scheduler.noteSkipped(job.frame);
      return false;
    }

    this.activeCount += 1;
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

  public reset(): void {
    this.activeCount = 0;
    this.newestFrame = -1;
    this.presentedFrame = -1;
    this.scheduler.reset();
  }

  private async execute(job: RealEsrganFrameJob<TCapture, TResult>): Promise<void> {
    try {
      const capture = await job.capture();
      const result = await job.infer(capture);
      if (this.scheduler.isResultCurrent(job.frame) && job.frame === this.newestFrame) {
        job.publish(result);
      }
    } finally {
      this.activeCount -= 1;
      this.scheduler.markCompleted(job.frame);
    }
  }
}
