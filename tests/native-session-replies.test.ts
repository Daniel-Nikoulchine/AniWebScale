import { describe, expect, it } from 'vitest';
import {
  readMeasurementReply,
  readPrepareReply,
  readTitleNonceReply,
} from '../src/background/native-session-replies';

describe('native-session reply readers', () => {
  const malformed = [null, undefined, 'reply', 7, true];

  describe('readMeasurementReply', () => {
    it('accepts a full measurement reply and preserves its values', () => {
      const reply = { ok: true, videoRect: { left: 1, top: 2, width: 3, height: 4 }, innerWidth: 5, innerHeight: 6, devicePixelRatio: 2 };
      expect(readMeasurementReply(reply)).toBe(reply);
    });

    it('accepts a partial reply unchanged', () => {
      const reply = { ok: false };
      expect(readMeasurementReply(reply)).toBe(reply);
      expect(readMeasurementReply({ ok: true, videoRect: undefined })).toBeInstanceOf(Object);
    });

    it('returns null for malformed replies', () => {
      for (const value of malformed) expect(readMeasurementReply(value)).toBeNull();
    });
  });

  describe('readPrepareReply', () => {
    it('accepts a full prepare reply and preserves its values', () => {
      const reply = {
        ok: true,
        originalTitle: 'Old',
        intrinsicWidth: 1920,
        intrinsicHeight: 1080,
        targetWidth: 3840,
        targetHeight: 2160,
        message: 'ready',
      };
      expect(readPrepareReply(reply)).toBe(reply);
    });

    it('accepts a partial reply unchanged', () => {
      const reply = { ok: true, originalTitle: 'Old' };
      expect(readPrepareReply(reply)).toBe(reply);
      expect(readPrepareReply({})?.ok).toBeUndefined();
    });

    it('returns null for malformed replies', () => {
      for (const value of malformed) expect(readPrepareReply(value)).toBeNull();
    });
  });

  describe('readTitleNonceReply', () => {
    it('accepts a full reply and preserves its values', () => {
      const reply = { ok: true, originalTitle: 'Old' };
      expect(readTitleNonceReply(reply)).toBe(reply);
    });

    it('accepts a partial reply unchanged', () => {
      const reply = { ok: false };
      expect(readTitleNonceReply(reply)).toBe(reply);
    });

    it('returns null for malformed replies', () => {
      for (const value of malformed) expect(readTitleNonceReply(value)).toBeNull();
    });
  });
});
