/**
 * Centralized logging for the extension.
 *
 * Error/warning conditions keep using `console.warn`/`console.error` directly
 * at their call sites — those are always meaningful. This module is only for
 * verbose, high-frequency diagnostic messages (stash lifecycle, pipeline
 * transitions, …) that would otherwise spam the console of every user.
 *
 * Verbose output is gated behind the `verboseLogging` local setting so it can
 * be enabled on demand for troubleshooting without shipping noise by default.
 */

const PREFIX = '[AniWebScale]';

let verboseEnabled = false;
let initialized = false;

/** Read the verbose flag once from storage. Safe to call repeatedly. */
export async function initDebugLogging(): Promise<void> {
  try {
    const data = await chrome.storage.local.get('verboseLogging');
    verboseEnabled = data.verboseLogging === true;
  } catch {
    // Storage unavailable (e.g. during early startup) — stay quiet.
    verboseEnabled = false;
  }
  initialized = true;
}

/** Explicitly enable/disable verbose logging (used by the options toggle). */
export function setVerboseLogging(enabled: boolean): void {
  verboseEnabled = enabled;
  initialized = true;
}

export function isVerboseLoggingEnabled(): boolean {
  return verboseEnabled;
}

/**
 * Log a verbose diagnostic message. No-op unless verbose logging is enabled.
 * Accepts printf-style interpolation via the console's own formatting.
 */
export function debug(message: string, ...args: unknown[]): void {
  if (!verboseEnabled) return;
  if (!initialized) {
    // Best-effort: if logging fires before init, surface it rather than drop it.
    void initDebugLogging();
  }
  console.log(`${PREFIX} ${message}`, ...args);
}
