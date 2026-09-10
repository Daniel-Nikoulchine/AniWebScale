import { describe, expect, it, vi } from 'vitest';
import { EventScope } from '../src/shared/event-scope';

describe('EventScope', () => {
  it('removes registered listeners when disposed', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const scope = new EventScope();

    scope.on(target, 'change', handler);
    target.dispatchEvent(new Event('change'));
    scope.dispose();
    target.dispatchEvent(new Event('change'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs custom disposers once', () => {
    const disposer = vi.fn();
    const scope = new EventScope();
    scope.add(disposer);

    scope.dispose();
    scope.dispose();

    expect(disposer).toHaveBeenCalledOnce();
  });

  it('disposes the remaining listeners when a disposer throws', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const scope = new EventScope();
    // Throwing disposer first: the old abort-on-throw loop would leak the
    // listener registered after it.
    scope.add(() => { throw new Error('custom boom'); });
    scope.on(target, 'change', handler);

    // The first error still propagates, but every disposer ran.
    expect(() => scope.dispose()).toThrow('custom boom');
    target.dispatchEvent(new Event('change'));
    expect(handler).not.toHaveBeenCalled();
  });
});
