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
 * Transition revision ownership lives in EnhancerLifecycle. This module only
 * owns the committed backend phase, so backend state cannot become a second
 * lifecycle coordinator.
 */
export type BackendPhase = 'idle' | 'starting' | 'webgpu-active' | 'native-active';

export class BackendState {
  private phase: BackendPhase = 'idle';

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

  /** Mark a transition as in flight. Revision ownership stays in the lifecycle. */
  beginTransition(): void {
    this.phase = 'starting';
  }

  /** Abort every in-flight transition (destroy path). */
  destroy(): void {
    this.phase = 'idle';
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

}
