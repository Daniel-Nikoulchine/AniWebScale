import type { RealEsrganFrameScheduler } from '../shared/realesrgan-pacing';

export interface RealEsrganFrameJob<TCapture, TResult> {
  frame: number;
  capture: () => Promise<TCapture>;
  infer: (capture: TCapture) => Promise<TResult>;
  publish: (result: TResult) => void;
}

/**
 * Serializes one latest-frame-wins job and keeps stale-result handling in one
 * place. The scheduler remains the policy adapter; this module owns the
 * orchestration invariant and is intentionally independent of WebGPU/ORT.
 */
export class RealEsrganFrameJobRunner<TCapture, TResult> {
  private running = false;
  private newestFrame = -1;

  constructor(private readonly scheduler: RealEsrganFrameScheduler) {}

  public submit(job: RealEsrganFrameJob<TCapture, TResult>): boolean {
    this.newestFrame = Math.max(this.newestFrame, job.frame);
    if (this.running || !this.scheduler.shouldProcess(job.frame)) {
      this.scheduler.noteNewerFrame(job.frame);
      return false;
    }

    this.running = true;
    this.scheduler.noteNewerFrame(job.frame);
    this.scheduler.markStarted(job.frame);
    void this.execute(job);
    return true;
  }

  public reset(): void {
    this.running = false;
    this.newestFrame = -1;
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
      this.running = false;
      this.scheduler.markCompleted(job.frame);
    }
  }
}
