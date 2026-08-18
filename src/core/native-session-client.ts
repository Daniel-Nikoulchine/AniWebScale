import type { NativeConfiguration } from '../native/protocol';
import type { NativeFallbackReason } from '../shared/native-fallback-request';
import {
  enhancementClaimMessage,
  enhancementReleaseMessage,
  nativeFallbackRequestMessage,
  nativePlaybackStateMessage,
  nativeStopMessage,
  nativeUpdateConfigurationMessage,
  parseNativeFallbackResponse,
  parseStatusResponse,
} from '../shared/runtime-messages';

/** The capture rect a fallback request reports for the source video. */
export interface NativeCaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface NativeFallbackOutcome {
  ok: boolean;
  sessionId?: string;
  message?: string;
}

/**
 * The seam between an enhancer and the background's native-session machine.
 * Every runtime message for claiming, starting, stopping, updating and
 * releasing native sessions crosses here, built through the protocol
 * constructors and parsed through the protocol response parsers — the
 * enhancer never hand-rolls a wire payload. A fake client is the second
 * adapter at this seam in tests.
 */
export interface NativeSessionClient {
  /** Claim the single active-enhancement slot for a video. */
  claim(videoId: string): Promise<{ ok: boolean; message?: string }>;
  /** Fire-and-forget release of the active-enhancement slot. */
  release(videoId: string): Promise<void>;
  /** Ask the background to start the native renderer for a video. */
  requestFallback(input: {
    videoId: string;
    reason: NativeFallbackReason;
    configuration: NativeConfiguration;
    rect: NativeCaptureRect;
  }): Promise<NativeFallbackOutcome>;
  /**
   * Guarantee no native session for a video — now and from any fallback
   * request still awaiting its response: in-flight requests are marked, and
   * a late successful response is absorbed by a compensating stop instead of
   * resolving as a started session.
   */
  stop(input: { sessionId?: string; videoId?: string }): Promise<void>;
  /** Whether a fallback request for this video is still awaiting its response. */
  hasPendingFallback(videoId: string): boolean;
  /** Push a new configuration to the active native session. */
  updateConfiguration(input: {
    sessionId?: string;
    videoId?: string;
    configuration: NativeConfiguration;
  }): Promise<{ ok: boolean; message?: string }>;
  /** Fire-and-forget playback heartbeat for the active native session. */
  sendPlaybackState(input: {
    sessionId: string;
    videoId: string;
    playbackActive: boolean;
    mediaTime: number;
  }): Promise<void>;
}

type Send = (message: unknown) => Promise<unknown>;

export function createNativeSessionClient(send: Send = message => chrome.runtime.sendMessage(message)): NativeSessionClient {
  /** In-flight fallback requests per video, absorbing stops issued mid-flight. */
  const pendingFallbacks = new Map<string, { stopRequested: boolean }>();
  return {
    async claim(videoId) {
      return parseStatusResponse(await send(enhancementClaimMessage(videoId)));
    },
    async release(videoId) {
      await send(enhancementReleaseMessage(videoId)).catch(() => undefined);
    },
    async requestFallback(input) {
      const pending = { stopRequested: false };
      pendingFallbacks.set(input.videoId, pending);
      try {
        const response = parseNativeFallbackResponse(await send(nativeFallbackRequestMessage({
          videoId: input.videoId,
          reason: input.reason,
          configuration: input.configuration,
          output: 'auto',
          videoRect: input.rect,
        })));
        if (response.ok && pending.stopRequested) {
          // A stop was issued while this request was in flight. Absorb the
          // late session instead of letting it resolve as started.
          if (response.sessionId !== undefined) {
            await send(nativeStopMessage({ sessionId: response.sessionId, videoId: input.videoId }))
              .catch(() => undefined);
          }
          return {
            ok: false,
            message: 'The native renderer start was stopped before it completed.',
          };
        }
        return {
          ok: response.ok,
          ...(response.sessionId !== undefined ? { sessionId: response.sessionId } : {}),
          ...(response.message !== undefined ? { message: response.message } : {}),
        };
      } finally {
        pendingFallbacks.delete(input.videoId);
      }
    },
    async stop(input) {
      if (input.videoId !== undefined) {
        const pending = pendingFallbacks.get(input.videoId);
        if (pending) pending.stopRequested = true;
      }
      await send(nativeStopMessage(input));
    },
    hasPendingFallback(videoId) {
      return pendingFallbacks.has(videoId);
    },
    async updateConfiguration(input) {
      return parseStatusResponse(await send(nativeUpdateConfigurationMessage(input)));
    },
    async sendPlaybackState(input) {
      await send(nativePlaybackStateMessage(input)).catch(() => undefined);
    },
  };
}
