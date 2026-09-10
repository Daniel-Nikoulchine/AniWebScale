import { createAsyncSerializer } from '../shared/async-serializer';

/**
 * Owns the Enhancer-Lifecycle ordering and cancellation rules. Backend state,
 * renderer resources, and native sessions are implementation details behind
 * this module's transition gate. The transition queue itself is the shared
 * async serializer; this module owns only the revision counters.
 */
export class EnhancerLifecycle {
  private readonly serializer = createAsyncSerializer();
  private revision = 0;
  /** Reconcile cancellation token (debounced fullscreen reconcile). Separate from transition revisions. */
  private reconcileRevision = 0;

  /** Enqueue work while keeping later transitions runnable after failure. */
  enqueue(operation: () => Promise<void>): Promise<void> {
    return this.serializer(operation);
  }

  /** Start a transition and invalidate every earlier transition. */
  begin(): number {
    this.revision += 1;
    return this.revision;
  }

  /** Whether a transition still owns the lifecycle. */
  isCurrent(revision: number): boolean {
    return revision === this.revision;
  }

  /** Invalidate pending work when the enhancer is destroyed. */
  invalidate(): void {
    this.revision += 1;
  }

  /** Reconcile cancellation token (debounced fullscreen reconcile). Separate from transition revisions. */
  beginReconcile(): number {
    this.reconcileRevision += 1;
    return this.reconcileRevision;
  }

  /** Whether a debounced reconcile token still owns the reconcile. */
  isReconcileCurrent(token: number): boolean {
    return token === this.reconcileRevision;
  }

  /** Invalidate every pending debounced reconcile. */
  invalidateReconcile(): void {
    this.reconcileRevision += 1;
  }

  /** Current reconcile token; observability/test seam. */
  currentReconcileToken(): number {
    return this.reconcileRevision;
  }
}
