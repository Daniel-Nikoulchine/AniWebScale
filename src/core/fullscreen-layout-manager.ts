import {
  ANIME4K_FULLSCREEN_DOCUMENT_ATTR,
  ANIME4K_FULLSCREEN_KEEP_ATTR,
  ANIME4K_FULLSCREEN_ROOT_ATTR,
  ANIME4K_FULLSCREEN_VIDEO_ATTR,
} from '../constants';
import { choosePlayerSurface, playerAncestorPath } from '../shared/player-surface';
import {
  applyTemporaryStyles,
  restoreTemporaryStyles,
  type TemporaryInlineStyles,
} from '../shared/temporary-restyle';

const STYLE_ID = 'anime4k-fullscreen-layout-style';
let activeManager: FullscreenLayoutManager | null = null;

interface LayoutState {
  root: HTMLElement;
  video: HTMLVideoElement;
  ancestors: HTMLElement[];
  rootStyles?: TemporaryInlineStyles;
  videoStyles?: TemporaryInlineStyles;
}

export class FullscreenLayoutManager {
  private state: LayoutState | null = null;

  public constructor(private video: HTMLVideoElement) {}

  public updateVideo(video: HTMLVideoElement): void {
    if (this.video === video) return;
    this.exit();
    this.video = video;
  }

  public enter(): void {
    const fullscreen = document.fullscreenElement;
    if (!fullscreen || this.state) return;
    activeManager?.exit();

    // Use the browser's fullscreen element itself as the layout root instead
    // of choosePlayerSurface()'s tight video wrapper. Player control bars
    // (progress bar, pause button, volume …) are frequently SIBLINGS of that
    // tight wrapper, not descendants. With the tight wrapper as root, the
    // visibility:hidden rule below permanently hid them — even when the player
    // tried to reveal them on mouse movement. The fullscreen element already
    // fills the viewport in native fullscreen, so making it the root keeps every
    // player control visible and interactive while the video CSS still fills it.
    const root = fullscreen instanceof HTMLElement
      ? fullscreen
      : choosePlayerSurface(this.video, fullscreen);
    const ancestors = playerAncestorPath(root, fullscreen);
    const state: LayoutState = { root, video: this.video, ancestors };
    this.state = state;
    activeManager = this;
    this.installStyle();
    document.documentElement.setAttribute(ANIME4K_FULLSCREEN_DOCUMENT_ATTR, 'true');
    root.setAttribute(ANIME4K_FULLSCREEN_ROOT_ATTR, 'true');
    this.video.setAttribute(ANIME4K_FULLSCREEN_VIDEO_ATTR, 'true');
    ancestors.forEach(element => element.setAttribute(ANIME4K_FULLSCREEN_KEEP_ATTR, 'true'));

    // Document CSS cannot cross a shadow boundary. Preserve exact inline
    // styles and apply the same layout directly when the selected surface is
    // inside an open shadow tree.
    if (root.getRootNode() instanceof ShadowRoot) {
      const properties: Record<string, string> = {
        position: 'fixed', top: '0', right: '0', bottom: '0', left: '0',
        width: '100vw', height: '100vh', 'max-width': 'none', 'max-height': 'none',
        'margin-top': '0', 'margin-right': '0', 'margin-bottom': '0', 'margin-left': '0',
        transform: 'none', overflow: 'hidden', 'background-color': '#000', visibility: 'visible',
      };
      state.rootStyles = applyTemporaryStyles(root, properties);
    }
    if (this.video.getRootNode() instanceof ShadowRoot) {
      const properties: Record<string, string> = {
        position: 'absolute', top: '0', right: '0', bottom: '0', left: '0',
        width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none',
        'object-fit': 'contain', 'margin-top': '0', 'margin-right': '0',
        'margin-bottom': '0', 'margin-left': '0', transform: 'none',
        'background-color': '#000', visibility: 'visible',
      };
      state.videoStyles = applyTemporaryStyles(this.video, properties);
    }
  }

  public exit(): void {
    const state = this.state;
    if (!state) return;
    state.root.removeAttribute(ANIME4K_FULLSCREEN_ROOT_ATTR);
    state.video.removeAttribute(ANIME4K_FULLSCREEN_VIDEO_ATTR);
    state.ancestors.forEach(element => element.removeAttribute(ANIME4K_FULLSCREEN_KEEP_ATTR));
    if (state.rootStyles) restoreTemporaryStyles(state.root, state.rootStyles);
    if (state.videoStyles) restoreTemporaryStyles(state.video, state.videoStyles);
    this.state = null;
    if (activeManager === this) {
      activeManager = null;
      document.documentElement.removeAttribute(ANIME4K_FULLSCREEN_DOCUMENT_ATTR);
      document.getElementById(STYLE_ID)?.remove();
    }
  }

  private installStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] {
        overflow: hidden !important;
        background: #000 !important;
      }
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] body {
        overflow: hidden !important;
        background: #000 !important;
        margin: 0 !important;
      }
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] body * {
        visibility: hidden !important;
      }
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] [${ANIME4K_FULLSCREEN_KEEP_ATTR}],
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] [${ANIME4K_FULLSCREEN_ROOT_ATTR}],
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] [${ANIME4K_FULLSCREEN_ROOT_ATTR}] * {
        visibility: visible !important;
      }
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] [${ANIME4K_FULLSCREEN_KEEP_ATTR}] {
        overflow: visible !important;
        transform: none !important;
        clip: auto !important;
      }
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] [${ANIME4K_FULLSCREEN_ROOT_ATTR}] {
        position: fixed !important;
        inset: 0 !important;
        box-sizing: border-box !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        border: 0 !important;
        transform: none !important;
        overflow: hidden !important;
        background: #000 !important;
        z-index: 2147483645 !important;
      }
      html[${ANIME4K_FULLSCREEN_DOCUMENT_ATTR}] video[${ANIME4K_FULLSCREEN_VIDEO_ATTR}] {
        position: absolute !important;
        inset: 0 !important;
        display: block !important;
        box-sizing: border-box !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        border: 0 !important;
        transform: none !important;
        object-fit: contain !important;
        background: #000 !important;
      }
    `;
    (document.head ?? document.documentElement).appendChild(style);
  }
}
