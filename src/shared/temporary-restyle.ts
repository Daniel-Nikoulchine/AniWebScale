/**
 * Temporary inline-style application with exact restoration.
 *
 * The fullscreen layout, the native isolation and the overlay manager all
 * need to (a) force a set of inline styles onto page elements, (b) promise to
 * restore the exact previous styles, and (c) avoid clobbering styles that the
 * page itself changed while the temporary style was active. This module is
 * that shared primitive.
 *
 * Semantics:
 * - `applyTemporaryStyles` snapshots the current value AND priority of every
 *   property before forcing the new value with `important`.
 * - `restoreTemporaryStyles` only restores a property when the element still
 *   carries exactly the value/priority we applied. If the page changed the
 *   property in the meantime, the page wins and we leave it alone.
 */
export interface TemporaryInlineStyle {
  originalValue: string;
  originalPriority: string;
  appliedValue: string;
  appliedPriority: string;
}

export type TemporaryInlineStyles = Map<string, TemporaryInlineStyle>;

/**
 * Force the given properties onto an element with `important`, snapshotting
 * the previous value/priority of each property for later restoration.
 */
export function applyTemporaryStyles(
  element: HTMLElement,
  properties: Readonly<Record<string, string>>,
): TemporaryInlineStyles {
  const snapshots: TemporaryInlineStyles = new Map();
  for (const [name, value] of Object.entries(properties)) {
    const originalValue = element.style.getPropertyValue(name);
    const originalPriority = element.style.getPropertyPriority(name);
    element.style.setProperty(name, value, 'important');
    snapshots.set(name, {
      originalValue,
      originalPriority,
      appliedValue: element.style.getPropertyValue(name),
      appliedPriority: element.style.getPropertyPriority(name),
    });
  }
  return snapshots;
}

/**
 * Restore the styles captured by `applyTemporaryStyles`. A property is only
 * restored when the element still carries the exact applied value/priority;
 * otherwise the page has modified it and its change is preserved.
 */
export function restoreTemporaryStyles(
  element: HTMLElement,
  snapshots: TemporaryInlineStyles,
): void {
  for (const [name, snapshot] of snapshots) {
    if (element.style.getPropertyValue(name) !== snapshot.appliedValue
        || element.style.getPropertyPriority(name) !== snapshot.appliedPriority) continue;
    if (!snapshot.originalValue && !snapshot.originalPriority) element.style.removeProperty(name);
    else element.style.setProperty(name, snapshot.originalValue, snapshot.originalPriority);
  }
}

/**
 * Convenience wrapper for a single-property snapshot (used by the overlay
 * manager for `opacity`).
 */
export function applyTemporaryProperty(
  element: HTMLElement,
  name: string,
  value: string,
): TemporaryInlineStyles {
  return applyTemporaryStyles(element, { [name]: value });
}
