/**
 * The backend-switching state machine for a single video enhancement.
 *
 * VideoEnhancer used to carry ~25 mutable fields and a hand-rolled revision
 * counter for cancellation. This module owns that state: which backend is
 * active (or starting), the transition revision, and the guards that async
 * operations use to detect they have been superseded.
 *
 * The machine has four phases:
 *
 *   idle            → nothing running
 *   starting        → a start/switch transition is in flight
 *   webgpu-active   → the in-page WebGPU renderer owns the enhancement
 *   native-active   → the native host owns the enhancement
 *
 * `beginTransition` bumps the revision; every async operation captures the
 * revision it started with and calls `isTransitionCurrent(revision)` before
 * committing any state, so a superseded operation aborts instead of
 * clobbering the newer one.
 */
export type BackendPhase = 'idle' | 'starting' | 'webgpu-active' | 'native-active';

export class BackendState {
  private phase: BackendPhase = 'idle';
  private transitionRevision = 0;
  private destroyed = false;

  /** Whether any enhancement is active or starting. */
  get isBusy(): boolean {
    return this.phase !== 'idle';
  }

  /** Whether an enhancement is actively rendering (not just starting). */
  get isActive(): boolean {
    return this.phase === 'webgpu-active' || this.phase === 'native-active';
  }

  /** Whether the native host currently owns the enhancement. */
  get isNativeActive(): boolean {
    return this.phase === 'native-active';
  }

  /** Whether the in-page WebGPU renderer currently owns the enhancement. */
  get isWebGPUActive(): boolean {
    return this.phase === 'webgpu-active';
  }

  /** Whether a start/switch transition is in flight. */
  get isStarting(): boolean {
    return this.phase === 'starting';
  }

  get phaseName(): BackendPhase {
    return this.phase;
  }

  /** Mark a transition as in flight and return its revision. */
  beginTransition(): number {
    this.transitionRevision += 1;
    this.phase = 'starting';
    return this.transitionRevision;
  }

  /** Abort every in-flight transition (destroy path). */
  destroy(): void {
    this.destroyed = true;
    this.phase = 'idle';
  }

  /**
   * True when the operation captured by `revision` is still the newest
   * transition and the enhancer is not destroyed.
   */
  isTransitionCurrent(revision: number): boolean {
    return !this.destroyed && revision === this.transitionRevision;
  }

  /** Commit the machine to the webgpu-active phase. */
  markWebGPUActive(): void {
    this.phase = 'webgpu-active';
  }

  /** Commit the machine to the native-active phase. */
  markNativeActive(): void {
    this.phase = 'native-active';
  }

  /** Return to idle (stop/cleanup path). */
  markIdle(): void {
    this.phase = 'idle';
  }

  /** Reset the transition revision (used when a transition supersedes itself). */
  resetTransitions(): void {
    this.transitionRevision = 0;
  }
}
