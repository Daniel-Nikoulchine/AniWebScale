/**
 * Decide whether the onboarding tab must open after install/update.
 *
 * Two independent gates:
 * - `hasCompletedOnboarding` is unset for fresh profiles (first install).
 * - `siteAccessModelAcknowledged` is unset for everyone who last finished
 *   onboarding before site access became per-site. When that model changed,
 *   previously granted access may no longer inject content scripts, so the
 *   user must be shown once how access is granted from the popup instead of
 *   silently living with an inert extension.
 */
export const SITE_ACCESS_ACKNOWLEDGED_KEY = 'siteAccessModelAcknowledged';

export function shouldReopenOnboarding(
  stored: Record<string, unknown>,
): boolean {
  return stored.hasCompletedOnboarding !== true
    || stored[SITE_ACCESS_ACKNOWLEDGED_KEY] !== true;
}
