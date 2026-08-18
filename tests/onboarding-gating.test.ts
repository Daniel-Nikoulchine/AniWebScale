import { describe, expect, it } from 'vitest';
import { shouldReopenOnboarding } from '../src/shared/onboarding-gating';

describe('onboarding gating', () => {
  it('opens for fresh profiles that never completed onboarding', () => {
    expect(shouldReopenOnboarding({})).toBe(true);
    expect(shouldReopenOnboarding({ hasCompletedOnboarding: false })).toBe(true);
  });

  it('reopens once for users who finished onboarding before per-site access', () => {
    expect(shouldReopenOnboarding({ hasCompletedOnboarding: true })).toBe(true);
  });

  it('stays closed once the per-site model was acknowledged', () => {
    expect(shouldReopenOnboarding({
      hasCompletedOnboarding: true,
      siteAccessModelAcknowledged: true,
    })).toBe(false);
  });
});
