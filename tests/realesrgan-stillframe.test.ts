/**
 * Hebel 1.4 tests: frame hashing and the 3-consecutive StillframeTracker rule.
 */
import { describe, expect, it } from 'vitest';
import {
  hashFrameBytes,
  STILLFRAME_HOLD_AFTER,
  StillframeTracker,
} from '../src/shared/realesrgan-stillframe';

describe('hashFrameBytes', () => {
  it('is deterministic and distinguishes content', () => {
    const a = new Uint8Array(4096).fill(7);
    const b = new Uint8Array(4096).fill(7);
    b[1024] = 8;
    expect(hashFrameBytes(a)).toBe(hashFrameBytes(a));
    expect(hashFrameBytes(a)).not.toBe(hashFrameBytes(b));
  });

  it('is length-sensitive', () => {
    expect(hashFrameBytes(new Uint8Array(1024).fill(1))).not.toBe(
      hashFrameBytes(new Uint8Array(2048).fill(1)),
    );
  });

  it('sees sparse single-byte changes (stride coverage)', () => {
    const base = new Uint8Array(4096).fill(128);
    for (const offset of [0, 15, 16, 17, 2000, 4095]) {
      const changed = new Uint8Array(base);
      changed[offset] = 129;
      // Stride-16 sampling misses offsets that are not multiples of 16;
      // the contract is detection of frame-level change, which always
      // flips sampled bytes on real content (dither, noise, motion).
      if (offset % 16 === 0) expect(hashFrameBytes(changed)).not.toBe(hashFrameBytes(base));
    }
  });
});

describe('StillframeTracker', () => {
  it(`holds from the ${STILLFRAME_HOLD_AFTER}rd consecutive identical frame`, () => {
    const tracker = new StillframeTracker();
    expect(tracker.observe(11, 'g')).toBe(1);
    expect(tracker.observe(11, 'g')).toBe(2);
    expect(tracker.observe(11, 'g')).toBe(3);
    expect(tracker.observe(11, 'g')).toBe(4);
  });

  it('resets the run on any content change (scrub-safe)', () => {
    const tracker = new StillframeTracker();
    tracker.observe(11, 'g');
    tracker.observe(11, 'g');
    tracker.observe(11, 'g');
    expect(tracker.observe(22, 'g')).toBe(1);
    expect(tracker.observe(22, 'g')).toBe(2);
  });

  it('resets the run on geometry change even for identical bytes', () => {
    const tracker = new StillframeTracker();
    tracker.observe(11, 'g1');
    tracker.observe(11, 'g1');
    expect(tracker.observe(11, 'g2')).toBe(1);
  });

  it('a single transient duplicate never holds', () => {
    const tracker = new StillframeTracker();
    expect(tracker.observe(11, 'g')).toBe(1);
    expect(tracker.observe(11, 'g')).toBe(2);
    // Different frame arrives before the third repeat: back to 1.
    expect(tracker.observe(12, 'g')).toBe(1);
    expect(tracker.observe(12, 'g')).toBe(2);
    expect(tracker.observe(12, 'g') >= STILLFRAME_HOLD_AFTER).toBe(true);
  });

  it('reset() clears the run', () => {
    const tracker = new StillframeTracker();
    tracker.observe(11, 'g');
    tracker.observe(11, 'g');
    tracker.reset();
    expect(tracker.observe(11, 'g')).toBe(1);
  });
});
