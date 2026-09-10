/** Repeated identical toasts within this window are dropped (see below). */
const NOTIFY_REPEAT_MS = 10_000;
let lastNotifyMessage = '';
let lastNotifyAt = 0;

export function showEnhancementNotification(message: string): void {
  // Content scripts can run before <body> exists; never crash the caller.
  if (typeof document === 'undefined' || !document.body) return;
  // The fullscreen reconcile retries a failed auto-start on every timeupdate
  // (~4/s while playing). Without this dedupe each retry stacks a fresh
  // 8-second toast for the same failure.
  const now = Date.now();
  if (message === lastNotifyMessage && now - lastNotifyAt < NOTIFY_REPEAT_MS) return;
  lastNotifyMessage = message;
  lastNotifyAt = now;
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
