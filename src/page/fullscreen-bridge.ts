/**
 * Runs in the page's main JavaScript world. A fullscreen video is a replaced
 * top-layer element, so its sibling WebGPU canvas cannot be displayed. While
 * fullscreen automation is enabled, retarget direct video fullscreen requests
 * to the video's parent surface before the browser consumes user activation.
 */
(() => {
  const marker = '__anime4kFullscreenBridgeInstalledV1';
  const protectedPlaybackAttribute = 'data-anime4k-protected-playback';
  const protectedPlaybackEvent = 'anime4k-protected-playback';
  const pageWindow = window as Window & { [marker]?: boolean };
  if (pageWindow[marker]) return;
  pageWindow[marker] = true;

  // This bridge runs at document_start in the page's MAIN world, before most
  // players initialize EME. Observe the generic media `encrypted` event in the
  // capture phase so Auto mode can select native rendering on every website,
  // including players that emit it before the isolated enhancer is attached.
  function markProtectedPlayback(): void {
    document.documentElement.setAttribute(protectedPlaybackAttribute, 'true');
    window.dispatchEvent(new CustomEvent(protectedPlaybackEvent));
  }

  document.addEventListener('encrypted', event => {
    const target = event.target;
    if (!(target instanceof HTMLMediaElement)) return;
    markProtectedPlayback();
  }, true);

  // Some players attach MediaKeys before the video node is discovered or swap
  // the node immediately afterwards. Intercept the standardized EME API as an
  // additional website-independent signal while preserving its native call.
  const nativeSetMediaKeys = HTMLMediaElement.prototype.setMediaKeys;
  if (typeof nativeSetMediaKeys === 'function') {
    HTMLMediaElement.prototype.setMediaKeys = function setAnime4KMediaKeys(
      mediaKeys: MediaKeys | null,
    ): Promise<void> {
      if (mediaKeys) markProtectedPlayback();
      return Reflect.apply(nativeSetMediaKeys, this, [mediaKeys]) as Promise<void>;
    };
  }

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
