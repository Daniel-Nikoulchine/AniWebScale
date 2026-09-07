/**
 * Runner failover guard for the RealESRGAN path: one module owns the
 * retry/disable/fallback-warmup policy that used to live inside the
 * pipeline god class (untestable without a GPUDevice).
 *
 * Policy: transient timeouts get `maxTimeouts` consecutive chances, then
 * the runner is declared dead, the main-thread fallback is warmed, and the
 * original error propagates. Anything untagged (or tagged otherwise) is
 * permanent and kills the runner on first sight. Transience rides on the
 * rejection's error-code tag (see realesrgan-error-codes), never on
 * re-parsed human text: producers tag, this module decides.
 */
import {
  REALESRGAN_TRANSIENT_ERROR_CODES,
  realEsrganErrorCodeOf,
} from '../shared/realesrgan-error-codes';

export interface RealEsrganRunnerGuardEvents {
  /** Consecutive timeouts before the runner is declared dead (default 3). */
  maxTimeouts?: number;
  /** Transient timeout below the budget: log line stays the caller's job. */
  onTimeout?: (attempt: number, max: number, error: unknown) => void;
  /**
   * Runner declared dead (permanent error or budget spent). May be async:
   * the guard awaits it so a broker escalation (markRunnerDead compares
   * cached promises) lands before the error propagates and the next
   * resolveRunner() can no longer re-serve the buried runner.
   */
  onRunnerDead?: (error: unknown) => unknown;
  /** Best-effort warmup of the main-thread fallback before rethrow. */
  warmFallback?: () => Promise<unknown>;
}

export class RealEsrganRunnerGuard {
  private timeouts = 0;
  private readonly maxTimeouts: number;
  private readonly events: RealEsrganRunnerGuardEvents;
  /** True once a permanent error (or spent budget) killed the runner. */
  dead = false;

  constructor(events: RealEsrganRunnerGuardEvents = {}) {
    this.events = events;
    this.maxTimeouts = events.maxTimeouts ?? 3;
  }

  async guard<T>(task: () => Promise<T>): Promise<T> {
    try {
      const result = await task();
      this.timeouts = 0;
      return result;
    } catch (error) {
      // A timeout may be transient (system busy, first-run shader compile
      // over budget). Permanent errors (runner gone, protocol) disable the
      // runner immediately. Untagged errors are permanent by default.
      const code = realEsrganErrorCodeOf(error);
      const transient = code !== null && REALESRGAN_TRANSIENT_ERROR_CODES.includes(code);
      this.timeouts = transient ? this.timeouts + 1 : Number.MAX_SAFE_INTEGER;
      if (this.timeouts < this.maxTimeouts) {
        this.events.onTimeout?.(this.timeouts, this.maxTimeouts, error);
        throw error;
      }
      // A broken runner must not drop the frame: mark it dead so the
      // caller detaches it, warm the fallback, then propagate.
      this.dead = true;
      await this.events.onRunnerDead?.(error);
      try {
        await this.events.warmFallback?.();
      } catch {
        // Warmup failure must not mask the runner error: the pipeline
        // classifies the propagated error (context lost etc.), and the
        // lazy drain path rebuilds the session on the next frame anyway.
      }
      throw error;
    }
  }
}
