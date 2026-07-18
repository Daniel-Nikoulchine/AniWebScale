import type { EnhancementMode, QualityTier } from '../types';
import {
  ENHANCEMENT_MODES,
  QUALITY_TIERS,
  isEnhancementMode,
  isQualityTier,
} from '../shared/presets';

/**
 * Wire protocol shared with the Windows Native Messaging host.
 *
 * Keep this surface deliberately small: the host locates the browser window by
 * a short-lived nonce in its title and never accepts arbitrary window handles,
 * executable paths, or URLs from the extension.
 */
export const NATIVE_HOST_NAME = 'io.github.anime4k_browser.native';
export const NATIVE_PROTOCOL_VERSION = 3 as const;

export type NativeEnhancementMode = EnhancementMode;
export type NativeQuality = QualityTier;
type NativeSessionState =
  | 'starting'
  | 'capturing'
  | 'stopping'
  | 'stopped'
  | 'failed';

interface NativeRequestBase {
  protocolVersion: typeof NATIVE_PROTOCOL_VERSION;
  requestId: string;
}

interface NativeSessionRequestBase extends NativeRequestBase {
  sessionId: string;
}

interface NativeHelloRequest extends NativeRequestBase {
  type: 'hello';
}

interface NativeCapabilitiesRequest extends NativeRequestBase {
  type: 'capabilities';
}

interface NativeStartRequest extends NativeSessionRequestBase {
  type: 'start';
  windowNonce: string;
  mode: NativeEnhancementMode;
  quality: NativeQuality;
  frameGenerationEnabled: boolean;
  targetWidth?: number;
  targetHeight?: number;
  captureX?: number;
  captureY?: number;
  captureWidth?: number;
  captureHeight?: number;
}

interface NativeUpdateConfigurationRequest extends NativeSessionRequestBase {
  type: 'updateConfiguration';
  mode: NativeEnhancementMode;
  quality: NativeQuality;
  frameGenerationEnabled: boolean;
}

interface NativeStopRequest extends NativeSessionRequestBase {
  type: 'stop';
}

interface NativeStatusRequest extends NativeSessionRequestBase {
  type: 'status';
  playbackActive?: boolean;
  mediaTime?: number;
}

export type NativeMediaCommandName =
  | 'playPause'
  | 'play'
  | 'pause'
  | 'seekBy'
  | 'volumeBy'
  | 'toggleMute'
  | 'toggleFullscreen'
  | 'exitFullscreen';

interface NativeMediaCommandRequest extends NativeSessionRequestBase {
  type: 'mediaCommand';
  command: NativeMediaCommandName;
  value?: number;
}

interface NativePointerRequest extends NativeSessionRequestBase {
  type: 'pointer';
  event: 'move' | 'down' | 'up' | 'wheel';
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

export type NativeRequest =
  | NativeHelloRequest
  | NativeCapabilitiesRequest
  | NativeStartRequest
  | NativeUpdateConfigurationRequest
  | NativeStopRequest
  | NativeStatusRequest
  | NativeMediaCommandRequest
  | NativePointerRequest;

interface NativeReadyEvent {
  type: 'ready';
  protocolVersion: number;
  requestId: string;
}

export interface NativeCapabilitiesEvent {
  type: 'capabilities';
  protocolVersion: number;
  requestId: string;
  windowsCapture: boolean;
  d3d11: boolean;
  modes: NativeEnhancementMode[];
  qualities: NativeQuality[];
  frameGeneration: boolean;
}

export interface NativeStatusEvent {
  type: 'status';
  protocolVersion: number;
  requestId?: string;
  sessionId: string;
  state: NativeSessionState;
  message?: string;
}

export interface NativeMetricsEvent {
  type: 'metrics';
  protocolVersion: number;
  sessionId: string;
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
}

export interface NativeErrorEvent {
  type: 'error';
  protocolVersion: number;
  requestId?: string;
  sessionId?: string;
  code: string;
  message: string;
  recoverable: boolean;
}

interface NativeStoppedEvent {
  type: 'stopped';
  protocolVersion: number;
  requestId?: string;
  sessionId: string;
  reason: string;
}

/** The native renderer may forward input using the same strict wire shape. */
export type NativeEvent =
  | NativeReadyEvent
  | NativeCapabilitiesEvent
  | NativeStatusEvent
  | NativeMetricsEvent
  | NativeErrorEvent
  | NativeStoppedEvent
  | NativeMediaCommandRequest
  | NativePointerRequest;

export interface NativeConfiguration {
  mode: NativeEnhancementMode;
  quality: NativeQuality;
  frameGenerationEnabled: boolean;
}

const MODES: ReadonlySet<string> = new Set(ENHANCEMENT_MODES);
const QUALITIES: ReadonlySet<string> = new Set(QUALITY_TIERS);

export function isNativeEnhancementMode(value: unknown): value is NativeEnhancementMode {
  return isEnhancementMode(value) && MODES.has(value);
}

export function isNativeQuality(value: unknown): value is NativeQuality {
  return isQualityTier(value) && QUALITIES.has(value);
}

export function isNativeConfiguration(value: unknown): value is NativeConfiguration {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NativeConfiguration>;
  return isNativeEnhancementMode(candidate.mode)
    && isNativeQuality(candidate.quality)
    && typeof candidate.frameGenerationEnabled === 'boolean';
}

export function isWindowNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
}

export function isNativeEvent(value: unknown): value is NativeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (event.protocolVersion !== NATIVE_PROTOCOL_VERSION || typeof event.type !== 'string') {
    return false;
  }

  const hasRequestId = event.requestId === undefined || typeof event.requestId === 'string';
  const hasSessionId = typeof event.sessionId === 'string';
  switch (event.type) {
    case 'ready':
      return typeof event.requestId === 'string';
    case 'capabilities':
      return typeof event.requestId === 'string'
        && typeof event.windowsCapture === 'boolean'
        && typeof event.d3d11 === 'boolean'
        && Array.isArray(event.modes)
        && event.modes.every(isNativeEnhancementMode)
        && Array.isArray(event.qualities)
        && event.qualities.every(isNativeQuality)
        && typeof event.frameGeneration === 'boolean';
    case 'status':
      return hasRequestId && hasSessionId
        && typeof event.state === 'string'
        && ['starting', 'capturing', 'stopping', 'stopped', 'failed'].includes(event.state)
        && (event.message === undefined || typeof event.message === 'string');
    case 'metrics':
      return hasSessionId
        && typeof event.fps === 'number' && Number.isFinite(event.fps) && event.fps >= 0
        && typeof event.frameTimeMs === 'number' && Number.isFinite(event.frameTimeMs) && event.frameTimeMs >= 0
        && typeof event.droppedFrames === 'number' && Number.isFinite(event.droppedFrames)
        && event.droppedFrames >= 0;
    case 'error':
      return hasRequestId
        && (event.sessionId === undefined || hasSessionId)
        && typeof event.code === 'string'
        && typeof event.message === 'string'
        && typeof event.recoverable === 'boolean';
    case 'stopped':
      return hasRequestId && hasSessionId && typeof event.reason === 'string';
    case 'mediaCommand':
      return hasSessionId && typeof event.requestId === 'string'
        && typeof event.command === 'string'
        && ['playPause', 'play', 'pause', 'seekBy', 'volumeBy', 'toggleMute', 'toggleFullscreen', 'exitFullscreen'].includes(event.command)
        && (event.value === undefined || (typeof event.value === 'number' && Number.isFinite(event.value)));
    case 'pointer':
      return hasSessionId && typeof event.requestId === 'string'
        && typeof event.event === 'string' && ['move', 'down', 'up', 'wheel'].includes(event.event)
        && typeof event.x === 'number' && Number.isFinite(event.x) && event.x >= 0 && event.x <= 1
        && typeof event.y === 'number' && Number.isFinite(event.y) && event.y >= 0 && event.y <= 1
        && (event.button === undefined
          || (typeof event.button === 'number' && Number.isInteger(event.button) && event.button >= -1 && event.button <= 4))
        && (event.buttons === undefined
          || (typeof event.buttons === 'number' && Number.isInteger(event.buttons) && event.buttons >= 0))
        && (event.deltaX === undefined
          || (typeof event.deltaX === 'number' && Number.isFinite(event.deltaX)))
        && (event.deltaY === undefined
          || (typeof event.deltaY === 'number' && Number.isFinite(event.deltaY)))
        && (event.shiftKey === undefined || typeof event.shiftKey === 'boolean')
        && (event.ctrlKey === undefined || typeof event.ctrlKey === 'boolean')
        && (event.altKey === undefined || typeof event.altKey === 'boolean');
    default:
      return false;
  }
}
