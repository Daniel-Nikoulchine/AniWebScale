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
});
