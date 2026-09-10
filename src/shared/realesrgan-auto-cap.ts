/**
 * RealESRGAN Auto-Cap (Hebel C): ephemeral inference-height ladder driven by
 * sustained overload, never persisted.
 *
 * The user cap (`realesrganCapHeight`: 480 | 432 | 405) is the ceiling. While
 * the renderer reports sustained overload (its OverloadTracker already
 * windows 2 s; stats arrive every 500 ms), the effective cap steps down the
 * ladder 480 -> 432 -> 405 -> 360 with a cooldown between steps so the new
 * cap can take effect. 360 is the emergency rung (38 dB vs 405 on real
 * material, better than the routine 480-vs-405 step at 35 dB). When
 * inference runs with clear headroom for a longer window, the cap steps
 * back up — never above the user cap.
 *
 * Pure policy: no DOM, no storage, no renderer calls. The VideoEnhancer feeds
 * stats and applies returned steps via its serialized lifecycle
 * (updateConfiguration with rebuilt effects); the override resets on every
 * settings change, backend switch, stop and destroy.
 */
/**
 * The canonical cap-height ladder. The union type is derived from it so a rung
 * added or removed here flows through the storage schema, migration and UI
 * without a second literal list to keep in sync.
 */
export const REALESRGAN_CAP_LADDER = [480, 432, 405, 360] as const;

export type RealEsrganCapHeight = (typeof REALESRGAN_CAP_LADDER)[number];

/** True when a stored value is one of the canonical ladder rungs. */
export function isRealEsrganCapHeight(value: unknown): value is RealEsrganCapHeight {
  return typeof value === 'number'
    && (REALESRGAN_CAP_LADDER as readonly number[]).includes(value);
}

/** Cooldown between two down-steps (the new cap needs frames to settle). */
export const AUTO_CAP_DOWN_COOLDOWN_MS = 5000;
/** Sustained headroom before one step back up (anti-flap, asymmetric). */
export const AUTO_CAP_UP_WINDOW_MS = 15000;
/** inferMs below this share of the frame budget counts as headroom. */
export const AUTO_CAP_HEADROOM_RATIO = 0.6;

export interface AutoCapSample {
  /** Renderer overload verdict (already 2 s-windowed upstream). */
  warning: boolean;
  /** Averaged inference time, when the stats carry RealESRGAN phases. */
  inferMs: number | null;
  /** Renderer frame budget (adaptive); absent => no up-steps. */
  frameBudgetMs: number | null;
  now: number;
}

export class RealEsrganAutoCap {
  private userCap: RealEsrganCapHeight;
  private override: RealEsrganCapHeight | null = null;
  // Fresh policies are immediately eligible (overload already means the
  // pipeline had time to settle); reset() after a reconfigure cools down.
  private lastStepAt = -AUTO_CAP_DOWN_COOLDOWN_MS;
  private headroomSince: number | null = null;

  constructor(userCap: RealEsrganCapHeight) {
    this.userCap = userCap;
  }

  /** Effective cap: the override clamped to never exceed the user cap. */
  get effectiveCap(): RealEsrganCapHeight {
    if (this.override === null) return this.userCap;
    return this.override > this.userCap ? this.userCap : this.override;
  }

  get hasOverride(): boolean {
    return this.effectiveCap !== this.userCap;
  }

  /** Retarget after a settings change / backend switch / stop. */
  reset(userCap: RealEsrganCapHeight, now = 0): void {
    this.userCap = userCap;
    this.override = null;
    this.lastStepAt = now;
    this.headroomSince = null;
  }

  /**
   * Feed one stats sample. Returns the new effective cap when a step is due
   * (caller rebuilds effects), else null.
   */
  onStats(sample: AutoCapSample): RealEsrganCapHeight | null {
    const cap = this.effectiveCap;
    if (sample.warning) {
      this.headroomSince = null;
      const down = nextCapDown(cap);
      if (down === null) return null;
      if (sample.now - this.lastStepAt < AUTO_CAP_DOWN_COOLDOWN_MS) return null;
      this.override = down;
      this.lastStepAt = sample.now;
      return down;
    }
    // No overload: track headroom for a cautious step back up.
    const budget = sample.frameBudgetMs;
    const inferMs = sample.inferMs;
    if (budget === null || inferMs === null || inferMs >= budget * AUTO_CAP_HEADROOM_RATIO) {
      this.headroomSince = null;
      return null;
    }
    if (this.override === null || this.effectiveCap >= this.userCap) {
      this.headroomSince = null;
      return null;
    }
    if (this.headroomSince === null) this.headroomSince = sample.now;
    if (sample.now - this.headroomSince < AUTO_CAP_UP_WINDOW_MS) return null;
    if (sample.now - this.lastStepAt < AUTO_CAP_DOWN_COOLDOWN_MS) return null;
    const up = nextCapUp(this.effectiveCap);
    this.headroomSince = null;
    if (up === null || up > this.userCap) {
      this.override = null;
      this.lastStepAt = sample.now;
      return this.userCap;
    }
    this.override = up;
    this.lastStepAt = sample.now;
    return up;
  }
}

export function nextCapDown(cap: RealEsrganCapHeight): RealEsrganCapHeight | null {
  const index = REALESRGAN_CAP_LADDER.indexOf(cap);
  if (index < 0) return null;
  return REALESRGAN_CAP_LADDER[index + 1] ?? null;
}

export function nextCapUp(cap: RealEsrganCapHeight): RealEsrganCapHeight | null {
  const index = REALESRGAN_CAP_LADDER.indexOf(cap);
  if (index <= 0) return null;
  return REALESRGAN_CAP_LADDER[index - 1] ?? null;
}
