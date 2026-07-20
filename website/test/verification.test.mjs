import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCompleteVerificationCode,
  normalizeVerificationCode,
} from '../client/verification.mjs';

describe('email verification code handling', () => {
  it('keeps only the first six numeric digits', () => {
    assert.equal(normalizeVerificationCode(' 12a34-567 '), '123456');
  });

  it('only treats a six-digit code as complete', () => {
    assert.equal(isCompleteVerificationCode('12345'), false);
    assert.equal(isCompleteVerificationCode('123456'), true);
    assert.equal(isCompleteVerificationCode('12a3456'), true);
  });
});
