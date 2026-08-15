/**
 * Shared render-performance overload tracking.
 *
 * Both the in-page WebGPU renderer and the VideoEnhancer's native-session
 * handler need to decide when the renderer is "overloaded": sustained frame
 * times above the budget (or rising dropped-frame counts) for at least a
 * fixed window. The 2000 ms window heuristic used to live in two places;
 * this module is the single implementation of that window.
 */
const OVERLOAD_WINDOW_MS = 2000;

export class OverloadTracker {
  private overloadedSince: number | null = null;

  /** Reset all tracked state (backend switch / stop). */
  reset(): void {
    this.overloadedSince = null;
  }

  /**
   * Record whether the current sample is overloaded (the caller decides what
   * "overloaded" means: smoothed frame time over budget, rising dropped
   * frames, ...) and return whether the overload has been sustained for at
   * least the window.
   */
  recordSample(overloaded: boolean, now: number = performance.now()): boolean {
    if (overloaded) {
      if (this.overloadedSince === null) this.overloadedSince = now;
    } else {
      this.overloadedSince = null;
    }
    return this.overloadedSince !== null && now - this.overloadedSince >= OVERLOAD_WINDOW_MS;
  }

  /** Whether the renderer is currently inside the overload window. */
  get isOverloaded(): boolean {
    return this.overloadedSince !== null;
  }
}
