import { selectNativeSurfacePointerAction } from './native-pointer-controls';
import {
  selectPointerMediaFallback,
  type PointerFallbackCommand,
} from './pointer-fallback';

/**
 * Everything needed to resolve one pointer event forwarded by the native
 * output window into a single gesture decision. The DOM hit-test results
 * (descriptor, ratios, target kind) are computed by the caller.
 */
export interface NativeGestureInput {
  event: 'move' | 'down' | 'up' | 'wheel';
  button: number;
  buttons: number;
  normalizedX: number;
  normalizedY: number;
  deltaY: number;
  duration: number;
  currentTime: number;
  volume: number;
  descriptor: string;
  targetIsVideo: boolean;
  targetRatioX: number;
  /** Whether the hit element is a button, input, or slider-like role. */
  interactiveTarget: boolean;
  /** Whether a native isolation session currently owns the page. */
  hasIsolation: boolean;
  /** Whether a native seek scrub is already in progress. */
  scrubbing: boolean;
}

/**
 * The single decision for one forwarded pointer event:
 * - `seek`: the native seek surface owns the gesture; apply the seek time.
 * - `suppress-fullscreen-control`: a redundant fullscreen toggle while the
 *   native output already is fullscreen; swallow it (optionally notifying).
 * - `synthesize`: dispatch synthetic pointer events to the page and, if the
 *   page ignores them, fall back to a direct media command.
 */
export type NativeGestureResolution =
  | { kind: 'seek'; seekTime?: number; scrubbing: boolean }
  | { kind: 'suppress-fullscreen-control'; notify: boolean; scrubbing: boolean }
  | { kind: 'synthesize'; fallback: PointerFallbackCommand | null; scrubbing: boolean };

const FULLSCREEN_CONTROL_PATTERN = /fullscreen|full-screen|enter-full|exit-full/i;

/**
 * Resolves one forwarded native pointer event. Order matters: the native seek
 * surface is consulted first so an active scrub (or a press in the bottom
 * seek zone) is consumed before any page-control fallback can short-circuit
 * the gesture. Only a gesture that resolved to neither a seek nor a media
 * fallback may be suppressed as a redundant fullscreen toggle.
 */
export function resolveNativePointerGesture(
  input: NativeGestureInput,
): NativeGestureResolution {
  let scrubbing = input.scrubbing;

  if (input.hasIsolation && (scrubbing || !input.interactiveTarget)) {
    const surfaceAction = selectNativeSurfacePointerAction({
      event: input.event,
      button: input.button,
      buttons: input.buttons,
      normalizedX: input.normalizedX,
      normalizedY: input.normalizedY,
      duration: input.duration,
      scrubbing,
    });
    scrubbing = surfaceAction.scrubbing;
    if (surfaceAction.consume) {
      return { kind: 'seek', seekTime: surfaceAction.seekTime, scrubbing };
    }
  }

  const fallback = selectPointerMediaFallback({
    event: input.event,
    button: input.button,
    descriptor: input.descriptor,
    targetIsVideo: input.targetIsVideo,
    targetRatioX: input.targetRatioX,
    deltaY: input.deltaY,
    duration: input.duration,
    currentTime: input.currentTime,
    volume: input.volume,
  });

  // Only treat a gesture as a fullscreen toggle when it did not already
  // resolve to a concrete media command and is not an active native scrub.
  if (input.hasIsolation && !fallback && !scrubbing
      && FULLSCREEN_CONTROL_PATTERN.test(input.descriptor)) {
    return {
      kind: 'suppress-fullscreen-control',
      notify: input.event === 'up',
      scrubbing,
    };
  }

  return { kind: 'synthesize', fallback, scrubbing };
}
