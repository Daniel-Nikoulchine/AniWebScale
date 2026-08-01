import { fullscreenContainsVideo } from './fullscreen-video';

export interface RectSize {
  width: number;
  height: number;
}

export function isPlausiblePlayerSurface(video: RectSize, candidate: RectSize): boolean {
  if (video.width <= 0 || video.height <= 0 || candidate.width <= 0 || candidate.height <= 0) return false;
  return candidate.width >= video.width * 0.9
    && candidate.height >= video.height * 0.9
    && candidate.width <= video.width * 1.2
    && candidate.height <= video.height * 1.22;
}

export function selectNativeCaptureSurfaceScope(options: {
  fullscreenContainsVideo: boolean;
  hasLocalFullscreenElement: boolean;
}): 'fullscreen' | 'player' {
  return options.hasLocalFullscreenElement && options.fullscreenContainsVideo
    ? 'fullscreen'
    : 'player';
}

function composedParent(element: Element): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
    ? root.host as HTMLElement
    : null;
}

/** Finds the highest compact ancestor that still describes the video player,
 * excluding broad page roots such as Crunchyroll's document fullscreen. */
export function choosePlayerSurface(
  video: HTMLVideoElement,
  fullscreen: Element | null,
): HTMLElement {
  const immediate = composedParent(video);
  if (!immediate || !fullscreenContainsVideo(fullscreen, video)) return immediate ?? video;
  const videoRect = video.getBoundingClientRect();
  let selected = immediate;
  let current: HTMLElement | null = immediate;
  let depth = 0;
  while (current && depth < 12) {
    if (current === document.body || current === document.documentElement) break;
    const rect = current.getBoundingClientRect();
    if (isPlausiblePlayerSurface(videoRect, rect)) selected = current;
    if (current === fullscreen) break;
    current = composedParent(current);
    depth += 1;
  }
  return selected;
}

export function playerAncestorPath(root: HTMLElement, fullscreen: Element | null): HTMLElement[] {
  const path: HTMLElement[] = [];
  let current: HTMLElement | null = root;
  while (current) {
    path.push(current);
    if (current === fullscreen || current === document.body || current === document.documentElement) break;
    current = composedParent(current);
  }
  return path;
}
