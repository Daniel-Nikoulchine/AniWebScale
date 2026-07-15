/** Native failures that cannot recover while the same fullscreen surface stays active. */
export function blocksNativeRetry(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const detail = event as Record<string, unknown>;
  return (detail.type === 'error' && detail.code === 'protected_capture_blocked')
    || (detail.type === 'stopped' && detail.reason === 'protected_content');
}
