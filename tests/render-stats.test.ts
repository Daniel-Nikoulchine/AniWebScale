import { describe, expect, it } from 'vitest';
import { OverloadTracker } from '../src/core/render-stats';
import {
  PRESENT_CURRENT_FRAME,
  PRESENT_PREVIOUS_FRAME,
  PRESENT_INTERMEDIATE_FRAME,
  presentationUniformFor,
  INTERPOLATION_UNIFORM_BINDING,
} from '../src/core/presentation-protocol';

describe('OverloadTracker', () => {
  it('does not warn before the window elapses', () => {
    const tracker = new OverloadTracker();
    expect(tracker.recordSample(true, 1000)).toBe(false);
    expect(tracker.recordSample(true, 2500)).toBe(false); // 1500ms, unter 2000ms
    expect(tracker.isOverloaded).toBe(true);
  });

  it('warns after the overload is sustained for 2000ms', () => {
    const tracker = new OverloadTracker();
    tracker.recordSample(true, 1000);
    expect(tracker.recordSample(true, 3000)).toBe(true);
  });

  it('clears the window when a sample is not overloaded', () => {
    const tracker = new OverloadTracker();
    tracker.recordSample(true, 1000);
    tracker.recordSample(true, 2500);
    expect(tracker.recordSample(false, 2600)).toBe(false);
    expect(tracker.isOverloaded).toBe(false);
    // A later overload starts a fresh window.
    expect(tracker.recordSample(true, 2700)).toBe(false);
    expect(tracker.recordSample(true, 5000)).toBe(true);
  });

  it('reset clears the window', () => {
    const tracker = new OverloadTracker();
    tracker.recordSample(true, 1000);
    tracker.recordSample(true, 3000);
    expect(tracker.isOverloaded).toBe(true);
    tracker.reset();
    expect(tracker.isOverloaded).toBe(false);
    expect(tracker.recordSample(true, 3100)).toBe(false);
  });

  it('only warns while samples keep coming', () => {
    const tracker = new OverloadTracker();
    tracker.recordSample(true, 1000);
    tracker.recordSample(true, 3000);
    expect(tracker.recordSample(true, 4000)).toBe(true);
    expect(tracker.recordSample(true, 5000)).toBe(true);
  });
});

describe('presentation protocol', () => {
  it('encodes the three presentation modes as documented', () => {
    expect([...PRESENT_CURRENT_FRAME]).toEqual([1, 0, 0, 0]);
    expect([...PRESENT_PREVIOUS_FRAME]).toEqual([0, 0, 0, 0]);
    expect([...PRESENT_INTERMEDIATE_FRAME]).toEqual([0.5, 0, 0, 0]);
  });

  it('presentationUniformFor resolves each mode', () => {
    expect(presentationUniformFor('current')).toBe(PRESENT_CURRENT_FRAME);
    expect(presentationUniformFor('previous')).toBe(PRESENT_PREVIOUS_FRAME);
    expect(presentationUniformFor('intermediate')).toBe(PRESENT_INTERMEDIATE_FRAME);
  });

  it('documents the WGSL binding index the shader must match', () => {
    expect(INTERPOLATION_UNIFORM_BINDING).toBe(3);
  });
});
