/**
 * Canonical native pointer declarations.
 *
 * Pure: no chrome, DOM or protocol imports. The native wire protocol
 * (`src/native/protocol.ts`) re-exports these so every existing importer keeps
 * working, and the runtime-message seam imports the same type instead of
 * maintaining a second, looser copy.
 */

export const NATIVE_POINTER_EVENT_TYPES = ['move', 'down', 'up', 'wheel'] as const;

export type NativePointerEventType = (typeof NATIVE_POINTER_EVENT_TYPES)[number];

export function isNativePointerEventType(value: unknown): value is NativePointerEventType {
  return typeof value === 'string' && (NATIVE_POINTER_EVENT_TYPES as readonly string[]).includes(value);
}

/** The core fields a pointer payload must carry (all optional extras included). */
export interface NativePointerPayload {
  event: NativePointerEventType;
  x: number;
  y: number;
  button?: number;
  buttons?: number;
  deltaX?: number;
  deltaY?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/** Validate a native pointer payload's core fields (event, x, y in [0,1]). */
export function isNativePointerEventPayload(value: unknown): value is NativePointerPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return isNativePointerEventType(payload.event)
    && typeof payload.x === 'number' && Number.isFinite(payload.x) && payload.x >= 0 && payload.x <= 1
    && typeof payload.y === 'number' && Number.isFinite(payload.y) && payload.y >= 0 && payload.y <= 1;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * The single pointer-payload parser for every wire direction. `parseFrameMessage`
 * and (historically) `parseRuntimeRequest` both used to hand-roll the same field
 * list; this keeps the validation and normalization in one place.
 */
export function parseNativePointerPayload(value: unknown): NativePointerPayload | null {
  if (!isNativePointerEventPayload(value)) return null;
  return {
    event: value.event,
    x: value.x,
    y: value.y,
    ...(optionalFiniteNumber(value.button) !== undefined ? { button: value.button } : {}),
    ...(optionalFiniteNumber(value.buttons) !== undefined ? { buttons: value.buttons } : {}),
    ...(optionalFiniteNumber(value.deltaX) !== undefined ? { deltaX: value.deltaX } : {}),
    ...(optionalFiniteNumber(value.deltaY) !== undefined ? { deltaY: value.deltaY } : {}),
    ...(optionalBoolean(value.shiftKey) !== undefined ? { shiftKey: value.shiftKey } : {}),
    ...(optionalBoolean(value.ctrlKey) !== undefined ? { ctrlKey: value.ctrlKey } : {}),
    ...(optionalBoolean(value.altKey) !== undefined ? { altKey: value.altKey } : {}),
  };
}

/** Clamp normalized coordinates into [0,1] (defensive, used on the content side). */
export function clampNativePointerCoords(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0)),
    y: Math.min(1, Math.max(0, Number.isFinite(y) ? y : 0)),
  };
}
