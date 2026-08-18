import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullscreenLayoutManager } from '../src/core/fullscreen-layout-manager';

class FakeElement {
  attributes = new Map<string, string>();
  parentElement: FakeElement | null = null;
  removed = false;
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  getRootNode(): object {
    return {};
  }
  remove(): void {
    this.removed = true;
  }
}
class FakeHTMLElement extends FakeElement {}

function installDocument() {
  let styleElement: FakeElement | null = null;
  const documentElement = new FakeElement();
  const document = {
    documentElement,
    head: { appendChild: () => undefined },
    body: new FakeElement(),
    getElementById: (id: string) => (id === 'anime4k-fullscreen-layout-style' ? styleElement : null),
    createElement: () => {
      styleElement = new FakeElement();
      return styleElement as unknown as HTMLStyleElement;
    },
  };
  vi.stubGlobal('document', document);
  return { document, style: () => styleElement, documentElement };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fullscreen layout manager enter/exit transaction', () => {
  it('marks document, root and video and installs the style once', () => {
    const { style, documentElement } = installDocument();
    vi.stubGlobal('ShadowRoot', class {});
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    const video = new FakeElement();
    const fullscreen = new FakeHTMLElement();

    const manager = new FullscreenLayoutManager(video as unknown as HTMLVideoElement);
    manager.enter(fullscreen as unknown as HTMLElement);

    expect(documentElement.attributes.get('data-anime4k-fullscreen-document')).toBe('true');
    expect(fullscreen.attributes.get('data-anime4k-fullscreen-root')).toBe('true');
    expect(video.attributes.get('data-anime4k-fullscreen-video')).toBe('true');

    // A second enter while active is a no-op; nothing double-applies.
    manager.enter(fullscreen as unknown as HTMLElement);
    expect(style()?.removed).toBe(false);

    manager.exit();
    expect(fullscreen.attributes.has('data-anime4k-fullscreen-root')).toBe(false);
    expect(video.attributes.has('data-anime4k-fullscreen-video')).toBe(false);
    expect(documentElement.attributes.has('data-anime4k-fullscreen-document')).toBe(false);
    expect(style()?.removed).toBe(true);
  });

  it('hands over from the active manager to the next one', () => {
    installDocument();
    vi.stubGlobal('ShadowRoot', class {});
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    const videoOne = new FakeElement();
    const videoTwo = new FakeElement();
    const rootOne = new FakeHTMLElement();
    const rootTwo = new FakeHTMLElement();

    const first = new FullscreenLayoutManager(videoOne as unknown as HTMLVideoElement);
    first.enter(rootOne as unknown as HTMLElement);
    expect(rootOne.attributes.has('data-anime4k-fullscreen-root')).toBe(true);

    const second = new FullscreenLayoutManager(videoTwo as unknown as HTMLVideoElement);
    second.enter(rootTwo as unknown as HTMLElement);

    // Entering the second manager exits the first: one layout at a time.
    expect(rootOne.attributes.has('data-anime4k-fullscreen-root')).toBe(false);
    expect(rootTwo.attributes.has('data-anime4k-fullscreen-root')).toBe(true);
  });

  it('ignores enter without a fullscreen element', () => {
    installDocument();
    vi.stubGlobal('ShadowRoot', class {});
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    const manager = new FullscreenLayoutManager(new FakeElement() as unknown as HTMLVideoElement);

    expect(() => manager.enter(null)).not.toThrow();
  });
});
