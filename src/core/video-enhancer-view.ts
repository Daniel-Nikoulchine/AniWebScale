import { isWithinFullscreenExitGrace, videoFillsOwnViewport } from '../shared/fullscreen-video';
import { fullscreenContext } from './fullscreen-context';

export function hasPlayerFullscreenSignal(video: HTMLVideoElement): boolean {
  const fullscreen = fullscreenContext.element;
  if (fullscreen && fullscreen.contains && fullscreen.contains(video)) return true;
  if (isWithinFullscreenExitGrace()) return false;
  return videoFillsOwnViewport(video);
}

export function showEnhancementNotification(message: string): void {
  const notification = document.createElement('div');
  notification.textContent = `Anime4K: ${message}`;
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '2147483647',
    maxWidth: '360px',
    padding: '12px 16px',
    borderRadius: '8px',
    background: '#2b2133',
    color: '#fff',
    boxShadow: '0 5px 24px rgba(0,0,0,.35)',
    font: '14px/1.45 system-ui, sans-serif',
  });
  document.body.appendChild(notification);
  window.setTimeout(() => notification.remove(), 8000);
}
