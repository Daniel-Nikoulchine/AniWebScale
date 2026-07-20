export const NATIVE_SEEK_ZONE_START = 0.88;

export interface NativeSurfacePointerInput {
  event: 'move' | 'down' | 'up' | 'wheel';
  button: number;
  buttons: number;
  normalizedX: number;
  normalizedY: number;
  duration: number;
  scrubbing: boolean;
}

export interface NativeSurfacePointerAction {
  consume: boolean;
  scrubbing: boolean;
  seekTime?: number;
}

const idleAction: NativeSurfacePointerAction = { consume: false, scrubbing: false };

/** Provides a site-independent seek surface for the native output. The bottom
 * strip starts a scrub, and an active scrub follows the pointer until release. */
export function selectNativeSurfacePointerAction(
  input: NativeSurfacePointerInput,
): NativeSurfacePointerAction {
  if (!Number.isFinite(input.duration) || input.duration <= 0) {
    return idleAction;
  }

  const ratio = Math.max(0, Math.min(1, input.normalizedX));
  const seekTime = ratio * input.duration;
  if (input.scrubbing) {
    if (input.event === 'move' && (input.buttons & 1) !== 0) {
      return { consume: true, scrubbing: true, seekTime };
    }
    if (input.event === 'up' && input.button === 0) {
      return { consume: true, scrubbing: false, seekTime };
    }
    if (input.event === 'move' && (input.buttons & 1) === 0) {
      return idleAction;
    }
    return { consume: true, scrubbing: true };
  }

  const insideSeekZone = Number.isFinite(input.normalizedY)
    && input.normalizedY >= NATIVE_SEEK_ZONE_START;
  if (insideSeekZone && input.button === 0 && (input.event === 'down' || input.event === 'up')) {
    return {
      consume: true,
      scrubbing: input.event === 'down',
      seekTime,
    };
  }
  return idleAction;
}
