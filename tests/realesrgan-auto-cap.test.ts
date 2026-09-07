/**
 * Hebel C (Auto-Cap): policy unit tests. Pure state machine, no DOM/timers —
 * time is injected via `now`.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTO_CAP_DOWN_COOLDOWN_MS,
  AUTO_CAP_UP_WINDOW_MS,
  RealEsrganAutoCap,
  nextCapDown,
  nextCapUp,
} from '../src/shared/realesrgan-auto-cap';

describe('realesrgan auto-cap ladder', () => {
  it('steps 480 -> 432 -> 405 -> 360 and back', () => {
    expect(nextCapDown(480)).toBe(432);
    expect(nextCapDown(432)).toBe(405);
    expect(nextCapDown(405)).toBe(360);
    expect(nextCapDown(360)).toBeNull();
    expect(nextCapUp(360)).toBe(405);
    expect(nextCapUp(405)).toBe(432);
    expect(nextCapUp(432)).toBe(480);
    expect(nextCapUp(480)).toBeNull();
  });
});

describe('RealEsrganAutoCap', () => {
  it('starts at the user cap with no override', () => {
    const cap = new RealEsrganAutoCap(480);
    expect(cap.effectiveCap).toBe(480);
    expect(cap.hasOverride).toBe(false);
  });

  it('steps down on overload and respects the cooldown', () => {
    const cap = new RealEsrganAutoCap(480);
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 })).toBe(432);
    expect(cap.effectiveCap).toBe(432);
    expect(cap.hasOverride).toBe(true);
    // Inside the cooldown: no second step.
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 12_000 })).toBeNull();
    expect(cap.effectiveCap).toBe(432);
    // After the cooldown: next rung.
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 + AUTO_CAP_DOWN_COOLDOWN_MS + 1 })).toBe(405);
    // Emergency rung, then bottom of the ladder: stays.
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 + 2 * AUTO_CAP_DOWN_COOLDOWN_MS + 2 })).toBe(360);
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 30_000 })).toBeNull();
    expect(cap.effectiveCap).toBe(360);
  });

  it('never steps above the user cap', () => {
    const cap = new RealEsrganAutoCap(432);
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 })).toBe(405);
    // Headroom at the user cap: no step (already at ceiling).
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: 41.7, now: 40_000 })).toBeNull();
    expect(cap.effectiveCap).toBe(405);
  });

  it('steps back up after sustained headroom, never past the user cap', () => {
    const cap = new RealEsrganAutoCap(480);
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 })).toBe(432);
    // Brief headroom: no step (anti-flap).
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: 41.7, now: 12_000 })).toBeNull();
    // Continued overload after the cooldown: steps to the bottom rung.
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 20_000 })).toBe(405);
    // Sustained headroom past the up window: one step up (405 -> 432).
    const t0 = 40_000;
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: 41.7, now: t0 })).toBeNull();
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: 41.7, now: t0 + AUTO_CAP_UP_WINDOW_MS + 1 })).toBe(432);
    expect(cap.hasOverride).toBe(true);
    // And back to the user cap with another sustained window.
    const t1 = t0 + AUTO_CAP_UP_WINDOW_MS + 10_000;
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: 41.7, now: t1 })).toBeNull();
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: 41.7, now: t1 + AUTO_CAP_UP_WINDOW_MS + 1 })).toBe(480);
    expect(cap.hasOverride).toBe(false);
  });

  it('does not step up without infer timings or budget', () => {
    const cap = new RealEsrganAutoCap(480);
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 })).toBe(432);
    expect(cap.onStats({ warning: false, inferMs: null, frameBudgetMs: 41.7, now: 40_000 })).toBeNull();
    expect(cap.onStats({ warning: false, inferMs: 10, frameBudgetMs: null, now: 60_000 })).toBeNull();
    expect(cap.effectiveCap).toBe(432);
  });

  it('reset clears the override and retargets the ceiling', () => {
    const cap = new RealEsrganAutoCap(480);
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 10_000 })).toBe(432);
    cap.reset(405, 50_000);
    expect(cap.effectiveCap).toBe(405);
    expect(cap.hasOverride).toBe(false);
    // Fresh cooldown after the reconfigure.
    expect(cap.onStats({ warning: true, inferMs: 50, frameBudgetMs: 41.7, now: 51_000 })).toBeNull();
  });
});
