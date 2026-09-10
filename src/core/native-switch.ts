/**
 * Intentional native→webgpu switch ledger. Lives beside the native seam: the
 * enhancer records the transition revision and the session id it is
 * abandoning so a terminal host event for that session can be swallowed
 * explicitly while the stop is in flight. Serialization and revision
 * ownership stay in EnhancerLifecycle; this is only the "which session did we
 * deliberately drop" memory.
 */
export class NativeSwitchLedger {
  private revision: number | null = null;
  private sessionId: string | null = null;

  /** Arm the switch with the transition revision and the abandoned session. */
  arm(revision: number, sessionId: string | null): void {
    this.revision = revision;
    this.sessionId = sessionId;
  }

  /** Whether the armed switch revision is still current. */
  isCurrent(isRevisionCurrent: (revision: number) => boolean): boolean {
    return this.revision !== null && isRevisionCurrent(this.revision);
  }

  /** Whether the armed switch abandons this session id. */
  abandons(sessionId: unknown): boolean {
    return this.sessionId !== null && sessionId === this.sessionId;
  }

  /**
   * Clears the armed revision if it equals `revision` (always clears the armed
   * session id). Omitting `revision` clears everything.
   */
  clear(revision?: number): void {
    if (revision === undefined || this.revision === revision) {
      this.revision = null;
    }
    this.sessionId = null;
  }
}
