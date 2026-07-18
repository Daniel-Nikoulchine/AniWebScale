/**
 * Runs in the page's main JavaScript world. A fullscreen video is a replaced
 * top-layer element, so its sibling WebGPU canvas cannot be displayed. While
 * fullscreen automation is enabled, retarget direct video fullscreen requests
 * to the video's parent surface before the browser consumes user activation.
 */
(() => {
  const marker = '__anime4kFullscreenBridgeInstalledV1';
  const pageWindow = window as Window & { [marker]?: boolean };
  if (pageWindow[marker]) return;
  pageWindow[marker] = true;

  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'requestFullscreen');
  const original = descriptor?.value as typeof Element.prototype.requestFullscreen | undefined;
  if (!descriptor || typeof original !== 'function') return;
  const nativeRequestFullscreen = original;

  function choosePlayerSurface(video: HTMLVideoElement): HTMLElement | null {
    const videoRect = video.getBoundingClientRect();
    let selected = video.parentElement;
    let current = video.parentElement;
    let depth = 0;
    while (current && current !== document.body && current !== document.documentElement && depth < 12) {
      const rect = current.getBoundingClientRect();
      const compact = rect.width >= videoRect.width * 0.9
        && rect.height >= videoRect.height * 0.9
        && rect.width <= videoRect.width * 1.2
        && rect.height <= videoRect.height * 1.22;
      if (compact) selected = current;
      current = current.parentElement;
      depth += 1;
    }
    return selected;
  }

  function requestAnime4KFullscreen(
    this: Element,
    options?: FullscreenOptions,
  ): Promise<void> {
    const surface = this instanceof HTMLVideoElement
      && this.getAttribute('data-anime4k-auto-fullscreen') === 'true'
      ? choosePlayerSurface(this)
      : null;
    const target = surface ?? this;
    return Reflect.apply(nativeRequestFullscreen, target, [options]) as Promise<void>;
  }

  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    ...descriptor,
    value: requestAnime4KFullscreen,
  });
})();
