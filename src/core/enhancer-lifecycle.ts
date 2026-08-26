/**
 * Owns the Enhancer-Lifecycle ordering and cancellation rules. Backend state,
 * renderer resources, and native sessions are implementation details behind
 * this module's transition gate.
 */
export class EnhancerLifecycle {
  private chain: Promise<void> = Promise.resolve();
  private revision = 0;

  /** Enqueue work while keeping later transitions runnable after failure. */
  enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.chain.then(operation, operation);
    this.chain = result.catch(() => undefined);
    return result;
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
}
