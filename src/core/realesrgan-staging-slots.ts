/**
 * Owns the RealESRGAN readback staging slots.
 *
 * A frame claims one of a fixed set of GPUBuffers before its readback copy is
 * encoded; the slot stays busy until the CPU-side drain has mapped and
 * unmapped the buffer, so a new frame must never write into it. This module
 * owns the buffers, the busy state, the free-slot scan, the pending claim
 * (encoded and awaiting afterSubmit()) and the release discipline — all in one
 * place instead of smeared across pass(), afterSubmit() and drain(). Callers
 * only ever hold an opaque claim; the buffer→claim mapping stays private for
 * release validation.
 *
 * Accepts the narrow PipelineGpuDevice port (its only device call is
 * createBuffer) so the pipeline can be driven by a fake in unit tests.
 */
import type { PipelineGpuDevice } from './pipeline-types';

export interface RealEsrganStagingSlotOptions {
  count: number;
  size: number;
  usage: GPUBufferUsageFlags;
  label?: string;
}

export interface RealEsrganStagingClaim {
  readonly index: number;
  readonly buffer: GPUBuffer;
}

export class RealEsrganStagingSlots {
  private readonly claims: RealEsrganStagingClaim[];
  private readonly busy: boolean[];
  private readonly claimByBuffer = new Map<GPUBuffer, RealEsrganStagingClaim>();
  private pending: { claim: RealEsrganStagingClaim; frame: number } | null = null;
  private cursor = 0;

  constructor(device: PipelineGpuDevice, options: RealEsrganStagingSlotOptions) {
    const label = options.label ?? 'RealESRGAN staging';
    // One claim object per slot, created once and reused: the claim path
    // allocates nothing (beyond the claim itself) on the hot per-frame path.
    this.claims = Array.from({ length: options.count }, (_, index) => {
      const buffer = device.createBuffer({
        label: `${label} ${index}`,
        size: options.size,
        usage: options.usage,
      });
      const claim: RealEsrganStagingClaim = { index, buffer };
      this.claimByBuffer.set(buffer, claim);
      return claim;
    });
    this.busy = this.claims.map(() => false);
  }

  /** A free claim, or null when every slot is in flight. */
  claim(): RealEsrganStagingClaim | null {
    const count = this.claims.length;
    for (let i = 0; i < count; i += 1) {
      const candidate = (this.cursor + i) % count;
      if (!this.busy[candidate]) {
        this.busy[candidate] = true;
        this.cursor = (candidate + 1) % count;
        return this.claims[candidate];
      }
    }
    return null;
  }

  /**
   * Record the claim whose copy was encoded and is awaiting afterSubmit().
   *
   * Contract: at most one claim is pending at a time. Callers must consume
   * the previous pending (takePending/releasePending) before recording the
   * next; `pass()` does this via releasePending() at its start. If a caller
   * violates that (a second pass() without an afterSubmit()), the previous
   * claim is released here instead of silently overwritten — otherwise its
   * slot stays busy forever and the pipeline wedges into "no free slot".
   */
  markPending(claim: RealEsrganStagingClaim, frame: number): void {
    const previous = this.pending;
    if (previous) {
      console.warn('[RealESRGAN] staging markPending overwrote an unconsumed pending claim; releasing the stale claim');
      this.release(previous.claim);
    }
    this.pending = { claim, frame };
  }

  /** Consume the pending claim without releasing it (normal afterSubmit path). */
  takePending(): { claim: RealEsrganStagingClaim; frame: number } | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  /** Consume the pending claim and release it (leak-recovery path). */
  releasePending(): { claim: RealEsrganStagingClaim; frame: number } | null {
    const pending = this.takePending();
    if (pending) this.release(pending.claim);
    return pending;
  }

  /** Mark a claim free; idempotent and safe for foreign claims. */
  release(claim: RealEsrganStagingClaim): void {
    if (this.claimByBuffer.get(claim.buffer) !== claim) return;
    this.busy[claim.index] = false;
  }

  get count(): number {
    return this.claims.length;
  }

  /**
   * Best-effort release of every staging buffer. A single failing destroy()
   * must not leak the remaining buffers, so each is isolated.
   */
  destroy(): void {
    for (const claim of this.claims) {
      try {
        claim.buffer.destroy();
      } catch {
        /* best-effort */
      }
    }
  }
}
