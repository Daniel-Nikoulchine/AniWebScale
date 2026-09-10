/**
 * The native host reason codes that block a retry while the same fullscreen
 * surface stays active. Named once here so the predicate never compares raw
 * magic strings at the call site.
 */
export const NATIVE_RETRY_BLOCKING_ERROR_CODES = ['protected_capture_blocked'] as const;
export const NATIVE_RETRY_BLOCKING_STOP_REASONS = ['protected_content'] as const;

const BLOCKING_ERROR_CODES: ReadonlySet<string> = new Set(NATIVE_RETRY_BLOCKING_ERROR_CODES);
const BLOCKING_STOP_REASONS: ReadonlySet<string> = new Set(NATIVE_RETRY_BLOCKING_STOP_REASONS);

/** Native failures that cannot recover while the same fullscreen surface stays active. */
export function blocksNativeRetry(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const detail = event as Record<string, unknown>;
  return (detail.type === 'error' && typeof detail.code === 'string' && BLOCKING_ERROR_CODES.has(detail.code))
    || (detail.type === 'stopped' && typeof detail.reason === 'string' && BLOCKING_STOP_REASONS.has(detail.reason));
}
