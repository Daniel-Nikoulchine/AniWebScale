import { describe, expect, it } from 'vitest';
import {
  applyTemporaryProperty,
  applyTemporaryStyles,
  restoreTemporaryStyles,
} from '../src/shared/temporary-restyle';

/** Minimal CSSStyleDeclaration fake (matches the project's node test env). */
class FakeStyle {
  private readonly properties = new Map<string, { value: string; priority: string }>();

  getPropertyValue(name: string): string {
    return this.properties.get(name)?.value ?? '';
  }

  getPropertyPriority(name: string): string {
    return this.properties.get(name)?.priority ?? '';
  }

  setProperty(name: string, value: string, priority = ''): void {
    this.properties.set(name, { value, priority });
  }

  removeProperty(name: string): string {
    const previous = this.getPropertyValue(name);
    this.properties.delete(name);
    return previous;
  }
}

function makeElement(): HTMLElement {
  return { style: new FakeStyle() } as unknown as HTMLElement;
}

describe('temporary-restyle', () => {
  it('forces styles with important and restores the exact previous values', () => {
    const element = makeElement();
    element.style.setProperty('opacity', '0.5');
    element.style.setProperty('transform', 'scale(0.9)', 'important');

    const snapshot = applyTemporaryStyles(element, {
      opacity: '0',
      transform: 'none',
      position: 'fixed',
    });

    expect(element.style.getPropertyValue('opacity')).toBe('0');
    expect(element.style.getPropertyPriority('opacity')).toBe('important');
    expect(element.style.getPropertyValue('transform')).toBe('none');
    expect(element.style.getPropertyValue('position')).toBe('fixed');

    restoreTemporaryStyles(element, snapshot);

    expect(element.style.getPropertyValue('opacity')).toBe('0.5');
    expect(element.style.getPropertyPriority('opacity')).toBe('');
    expect(element.style.getPropertyValue('transform')).toBe('scale(0.9)');
    expect(element.style.getPropertyPriority('transform')).toBe('important');
    expect(element.style.getPropertyValue('position')).toBe('');
  });

  it('removes a property that had no previous value', () => {
    const element = makeElement();
    const snapshot = applyTemporaryStyles(element, { zIndex: '10' });
    expect(element.style.getPropertyValue('zIndex')).toBe('10');
    restoreTemporaryStyles(element, snapshot);
    expect(element.style.getPropertyValue('zIndex')).toBe('');
  });

  it('preserves a page-modified property during restore', () => {
    const element = makeElement();
    element.style.setProperty('opacity', '0.5');
    const snapshot = applyTemporaryStyles(element, { opacity: '0' });
    // The page changes the value while the temporary style is active.
    element.style.setProperty('opacity', '0.25', 'important');
    restoreTemporaryStyles(element, snapshot);
    // Page wins: our temporary value was replaced, so we do not restore.
    expect(element.style.getPropertyValue('opacity')).toBe('0.25');
  });

  it('restores when the property still carries our applied value', () => {
    const element = makeElement();
    element.style.setProperty('opacity', '0.5');
    const snapshot = applyTemporaryStyles(element, { opacity: '0' });
    restoreTemporaryStyles(element, snapshot);
    expect(element.style.getPropertyValue('opacity')).toBe('0.5');
  });

  it('applyTemporaryProperty snapshots a single property', () => {
    const element = makeElement();
    element.style.setProperty('opacity', '0.9');
    const snapshot = applyTemporaryProperty(element, 'opacity', '0');
    expect(element.style.getPropertyValue('opacity')).toBe('0');
    restoreTemporaryStyles(element, snapshot);
    expect(element.style.getPropertyValue('opacity')).toBe('0.9');
  });

  it('restoring an empty snapshot is a no-op', () => {
    const element = makeElement();
    restoreTemporaryStyles(element, new Map());
    expect(element.style.getPropertyValue('opacity')).toBe('');
  });
});
