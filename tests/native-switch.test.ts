import { describe, expect, it } from 'vitest';
import { NativeSwitchLedger } from '../src/core/native-switch';

/** A revision controller standing in for EnhancerLifecycle.isCurrent. */
function revisionController() {
  let revision = 0;
  return {
    begin: () => ++revision,
    isCurrent: (value: number) => value === revision,
  };
}

describe('NativeSwitchLedger', () => {
  it('arms a native switch that is current while its revision is live', () => {
    const ledger = new NativeSwitchLedger();
    const revisions = revisionController();
    const revision = revisions.begin();
    ledger.arm(revision, 'session-old');

    expect(ledger.isCurrent(revisions.isCurrent)).toBe(true);
    expect(ledger.abandons('session-old')).toBe(true);
    expect(ledger.abandons('session-new')).toBe(false);
    expect(ledger.abandons(undefined)).toBe(false);
  });

  it('reports an armed native switch stale once a newer transition begins', () => {
    const ledger = new NativeSwitchLedger();
    const revisions = revisionController();
    ledger.arm(revisions.begin(), 'session-old');
    revisions.begin();

    expect(ledger.isCurrent(revisions.isCurrent)).toBe(false);
    // The abandoned session is remembered even when the revision is stale.
    expect(ledger.abandons('session-old')).toBe(true);
  });

  it('clear clears the session and a matching revision only', () => {
    const ledger = new NativeSwitchLedger();
    const revisions = revisionController();
    const revision = revisions.begin();
    ledger.arm(revision, 'session-old');

    ledger.clear(revision + 1);

    // Non-matching revision stays armed; the session id is always cleared.
    expect(ledger.isCurrent(revisions.isCurrent)).toBe(true);
    expect(ledger.abandons('session-old')).toBe(false);
  });

  it('clear clears everything when no revision is given', () => {
    const ledger = new NativeSwitchLedger();
    const revisions = revisionController();
    ledger.arm(revisions.begin(), 'session-old');

    ledger.clear();

    expect(ledger.isCurrent(revisions.isCurrent)).toBe(false);
    expect(ledger.abandons('session-old')).toBe(false);
  });
});
