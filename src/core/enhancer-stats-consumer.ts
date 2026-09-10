import type { Anime4KWebExtSettings, RenderStats } from '../types';
import { calculateAutoTargetDimensions } from '../shared/presets';
import { getEffectsForPreset } from '../utils/settings';
import { RealEsrganAutoCap, type RealEsrganCapHeight } from '../shared/realesrgan-auto-cap';
import { formatRealEsrganError, REALESRGAN_ERROR_CODES } from '../shared/realesrgan-error-codes';
import { createRenderStatsTap } from './render-stats-tap';
import type { Renderer } from './renderer';

/** Delay of the late-player/video swap auto-target refresh. */
export const AUTO_TARGET_REFRESH_DELAY_MS = 150;

/**
 * The narrow host seam the stats consumer needs. The enhancer owns settings,
 * renderer resources and the serialized lifecycle; this collaborator only
 * consumes stats, fans them out and drives the ephemeral Auto-Cap ladder.
 */
export interface StatsConsumerContext {
  isDestroyed(): boolean;
  getSettings(): Anime4KWebExtSettings | null;
  getRenderer(): Renderer | null;
  isWebGPUActive(): boolean;
  getVideo(): HTMLVideoElement;
  getCanvas(): HTMLCanvasElement;
  setOverlayStats(stats: RenderStats | null): void;
  /** Serialize with the enhancer lifecycle (settings/switch/fullscreen). */
  enqueue(operation: () => Promise<void>): Promise<void>;
  onRendererError(error: Error): Promise<void>;
}

/**
 * Owns the stats fan-out (overlay + Auto-Cap) and the late auto-target
 * refresh. The tap keeps the producer cadence (renderer windows / native
 * metrics) while consumers subscribe instead of the producer hand-wiring.
 */
export class EnhancerStatsConsumer {
  private readonly statsTap = createRenderStatsTap();
  private autoCap: RealEsrganAutoCap | null = null;
  private targetUpdateTimer?: number;
  private lastStats: RenderStats | null = null;

  constructor(private readonly ctx: StatsConsumerContext) {
    this.statsTap.subscribe(stats => {
      if (this.ctx.getSettings()?.statsEnabled) this.ctx.setOverlayStats(stats);
      else this.ctx.setOverlayStats(null);
    });
    this.statsTap.subscribe(stats => this.feedAutoCap(stats));
  }

  /** Latest stats window (500 ms cadence); retained for E2E timing gates. */
  get lastRenderedStats(): RenderStats | null {
    return this.lastStats;
  }

  /** Effective ephemeral Auto-Cap, or null when no policy is live. */
  get effectiveAutoCap(): RealEsrganCapHeight | null {
    return this.autoCap?.effectiveCap ?? null;
  }

  handleStats(stats: RenderStats): void {
    this.lastStats = stats;
    this.statsTap.emit(stats);
  }

  /** Retarget (or drop) the ephemeral override after a settings change. */
  applySettings(settings: Anime4KWebExtSettings): void {
    if (settings.mode === 'REALESRGAN') this.autoCap?.reset(settings.realesrganCapHeight, performance.now());
    else this.autoCap = null;
  }

  /** Drop the ephemeral override together with the renderer it configures. */
  releaseResources(): void {
    this.autoCap = null;
  }

  scheduleTargetUpdate(): void {
    if (!this.ctx.getRenderer() || this.ctx.isDestroyed()) return;
    if (this.targetUpdateTimer) window.clearTimeout(this.targetUpdateTimer);
    this.targetUpdateTimer = window.setTimeout(() => void this.refreshAutoTarget(), AUTO_TARGET_REFRESH_DELAY_MS);
  }

  /** Drop a queued auto-target refresh (detach/reattach/destroy). */
  clearTargetUpdate(): void {
    if (this.targetUpdateTimer) {
      window.clearTimeout(this.targetUpdateTimer);
      this.targetUpdateTimer = undefined;
    }
  }

  private feedAutoCap(stats: RenderStats): void {
    const settings = this.ctx.getSettings();
    if (settings?.mode !== 'REALESRGAN' || !this.ctx.getRenderer() || !this.ctx.isWebGPUActive()) return;
    this.autoCap ??= new RealEsrganAutoCap(settings.realesrganCapHeight);
    const step = this.autoCap.onStats({
      warning: stats.warning,
      inferMs: stats.realesrgan?.inferMs ?? null,
      frameBudgetMs: stats.frameBudgetMs ?? null,
      now: performance.now(),
    });
    if (step !== null) void this.ctx.enqueue(() => this.applyAutoCapStep(step));
  }

  /**
   * Commit one Auto-Cap ladder step on the live renderer. Runs inside the
   * serialized lifecycle so it can never interleave with a settings change or
   * backend switch; stale steps (a newer step or a settings reset landed
   * first) are dropped via the effective-cap check.
   */
  private async applyAutoCapStep(cap: RealEsrganCapHeight): Promise<void> {
    const renderer = this.ctx.getRenderer();
    const settings = this.ctx.getSettings();
    if (this.ctx.isDestroyed() || !renderer || !settings || settings.mode !== 'REALESRGAN') return;
    if (!this.autoCap || this.autoCap.effectiveCap !== cap) return;
    const targetDimensions = calculateAutoTargetDimensions(this.ctx.getVideo());
    const canvas = this.ctx.getCanvas();
    if (canvas.width !== targetDimensions.width || canvas.height !== targetDimensions.height) {
      canvas.width = targetDimensions.width;
      canvas.height = targetDimensions.height;
    }
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(settings.mode, settings.quality, cap),
        targetDimensions,
        frameGenerationEnabled: settings.frameGenerationEnabled,
      });
    } catch (error) {
      // The policy's override no longer describes the live pipeline: drop it
      // so the next overload verdict re-steps from the actual cap.
      this.autoCap?.reset(settings.realesrganCapHeight, performance.now());
      if (!this.ctx.isDestroyed() && this.ctx.getRenderer() === renderer) {
        await this.ctx.onRendererError(error as Error);
      }
      return;
    }
    // Coded so the E2E gate counts ladder steps by code, not by prose.
    console.info(formatRealEsrganError(REALESRGAN_ERROR_CODES.AUTO_CAP_STEP,
      `RealESRGAN auto-cap -> ${cap}p (sustained ${cap < settings.realesrganCapHeight ? 'overload' : 'headroom'})`));
  }

  private async refreshAutoTarget(): Promise<void> {
    const renderer = this.ctx.getRenderer();
    const settings = this.ctx.getSettings();
    if (!renderer || !settings || this.ctx.isDestroyed()) return;
    const targetDimensions = calculateAutoTargetDimensions(this.ctx.getVideo());
    const canvas = this.ctx.getCanvas();
    if (canvas.width === targetDimensions.width && canvas.height === targetDimensions.height) return;
    try {
      await renderer.updateConfiguration({
        effects: getEffectsForPreset(settings.mode, settings.quality, settings.realesrganCapHeight),
        targetDimensions,
        frameGenerationEnabled: settings.frameGenerationEnabled,
      });
    } catch (error) {
      if (!this.ctx.isDestroyed() && this.ctx.getRenderer() === renderer) {
        await this.ctx.onRendererError(error as Error);
      }
    }
  }
}
