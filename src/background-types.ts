/**
 * Type definitions for the background service worker's native-session state.
 *
 * Extracted from background.ts so the session/record shapes can be shared and
 * referenced without pulling in the orchestration logic. Pure types only — no
 * runtime behavior lives here.
 */
import type {
  NativeConfiguration,
  NativeMetricsEvent,
} from './native/protocol';
import { NATIVE_SESSION_VERSION } from './shared/session-recovery';

/** A video element prepared for direct-fullscreen native capture. */
export interface PreparedVideo {
  ok: boolean;
  originalTitle?: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  screenAvailWidth?: number;
  screenAvailHeight?: number;
  screenAvailLeft?: number;
  screenAvailTop?: number;
  devicePixelRatio?: number;
  targetWidth?: number;
  targetHeight?: number;
  message?: string;
}

/** Measurement of the player popup/fullscreen geometry reported by content. */
export interface PopupMeasurement {
  ok: boolean;
  innerWidth?: number;
  innerHeight?: number;
  outerWidth?: number;
  outerHeight?: number;
  devicePixelRatio?: number;
  screenAvailWidth?: number;
  screenAvailHeight?: number;
  screenAvailLeft?: number;
  screenAvailTop?: number;
  videoRect?: { left: number; top: number; width: number; height: number };
}

/** The persisted record describing an active or in-flight native session. */
export interface NativeSessionRecord {
  version: typeof NATIVE_SESSION_VERSION;
  captureKind: 'direct-fullscreen' | 'legacy-popup';
  phase: 'preparing' | 'active' | 'stopping';
  sessionId: string;
  nonce: string;
  tabId: number;
  frameId: number;
  videoId: string;
  origin: string;
  sourceUrl: string;
  topLevelUrl: string;
  sourceWindowId?: number;
  originalWindowId?: number;
  originalIndex?: number;
  originalWindowState?: chrome.windows.windowStateEnum;
  originalWindowBounds?: { left?: number; top?: number; width?: number; height?: number };
  popupWindowId?: number;
  originalTitle?: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  captureWidth?: number;
  captureHeight?: number;
  targetWidth?: number;
  targetHeight?: number;
  configuration: NativeConfiguration;
  output: 'auto';
  createdAt: number;
}

/** The last known native renderer status, mirrored to interested frames. */
export interface NativeStatusSnapshot {
  active: boolean;
  sessionId?: string;
  state?: string;
  message?: string;
  configuration?: NativeConfiguration;
  metrics?: Pick<NativeMetricsEvent, 'fps' | 'frameTimeMs' | 'droppedFrames'>;
}

/** Identifies the single video currently claimed for enhancement. */
export interface ActiveEnhancementRecord {
  tabId: number;
  frameId: number;
  videoId: string;
}
