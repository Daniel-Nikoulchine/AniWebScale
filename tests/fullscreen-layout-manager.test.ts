import { describe, expect, it } from 'vitest';
import { applyTemporaryStyles, restoreTemporaryStyles } from '../src/shared/temporary-restyle';

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

describe('fullscreen shadow style restoration', () => {
  it('restores only properties that still contain the extension value', () => {
    const style = new FakeStyle();
    const element = { style } as unknown as HTMLElement;
    style.setProperty('width', '640px', 'important');
    style.setProperty('height', '360px');

    const snapshots = applyTemporaryStyles(element, {
      position: 'fixed', width: '100vw', height: '100vh',
    });
    style.setProperty('height', '80vh');
    restoreTemporaryStyles(element, snapshots);

    expect(style.getPropertyValue('width')).toBe('640px');
    expect(style.getPropertyPriority('width')).toBe('important');
    expect(style.getPropertyValue('height')).toBe('80vh');
    expect(style.getPropertyValue('position')).toBe('');
  });

  it('restores temporary longhands independently when the site changes one edge', () => {
    const style = new FakeStyle();
    const element = { style } as unknown as HTMLElement;
    style.setProperty('right', '12px');

    const snapshots = applyTemporaryStyles(element, {
      top: '0', right: '0', bottom: '0', left: '0',
    });
    style.setProperty('top', '24px', 'important');
    restoreTemporaryStyles(element, snapshots);

    expect(style.getPropertyValue('top')).toBe('24px');
    expect(style.getPropertyPriority('top')).toBe('important');
    expect(style.getPropertyValue('right')).toBe('12px');
    expect(style.getPropertyValue('bottom')).toBe('');
    expect(style.getPropertyValue('left')).toBe('');
  });
});
