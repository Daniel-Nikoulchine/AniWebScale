import { describe, expect, it } from 'vitest';
import { RealEsrganFrameScheduler } from '../src/shared/realesrgan-pacing';
import { RealEsrganFrameJobRunner } from '../src/core/realesrgan-frame-job';

// A job whose inference never settles, so it stays in flight for the whole
// test. The scheduler delegates below only need the markStarted entry, not a
// completed result.
function inFlightJob(frame: number) {
  return {
    frame,
    capture: async () => `c${frame}`,
    infer: () => new Promise<string>(() => { void 0; }),
  };
}

describe('RealEsrganFrameJobRunner pacing delegation', () => {
  it('noteSkipped proxies to the scheduler skip count', () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner<string, string>(scheduler);
    expect(runner.submit(inFlightJob(1))).toBe(true);

    runner.noteSkipped(2);
    expect(scheduler.skippedFrames).toBe(1);
    expect(runner.skippedFrames).toBe(1);

    runner.noteSkipped(3);
    expect(scheduler.skippedFrames).toBe(2);
    expect(runner.skippedFrames).toBe(2);
  });

  it('newestInFlightFrame reflects marked-started frames', () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner<string, string>(scheduler);
    expect(runner.newestInFlightFrame()).toBe(-1);

    expect(runner.submit(inFlightJob(5))).toBe(true);
    expect(runner.newestInFlightFrame()).toBe(5);

    // Depth 2 admits a second concurrent job; the newest one wins the probe.
    expect(runner.submit(inFlightJob(9), 2)).toBe(true);
    expect(runner.newestInFlightFrame()).toBe(9);
    expect(scheduler.newestInFlightFrame()).toBe(9);
  });

  it('shouldStaleSkip is true only beyond the threshold', () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner<string, string>(scheduler);
    expect(runner.submit(inFlightJob(10))).toBe(true);

    expect(runner.shouldStaleSkip(5, 5)).toBe(false);
    expect(runner.shouldStaleSkip(4, 5)).toBe(true);
    expect(runner.shouldStaleSkip(9, 5)).toBe(false);
  });

  it('skippedFrames exposes the scheduler value without local counting', () => {
    const scheduler = new RealEsrganFrameScheduler();
    const runner = new RealEsrganFrameJobRunner<string, string>(scheduler);
    expect(runner.skippedFrames).toBe(0);

    // Idle skip: the scheduler advances its newest-seen watermark but does
    // not bill a gap. The getter must reflect that, not a local increment.
    runner.noteSkipped(4);
    expect(runner.skippedFrames).toBe(0);
    expect(scheduler.skippedFrames).toBe(0);
  });
});
