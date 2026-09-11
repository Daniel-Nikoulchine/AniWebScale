/// <reference types="@webgpu/types" />

import type {
  Anime4KMode as GeneratedAnime4KMode,
  QualityTier as GeneratedQualityTier,
} from './shared/generated-preset-graph';
import type { RealEsrganCapHeight } from './shared/realesrgan-auto-cap';

declare global {
  /** Compile-time gate; false in every distributable build. */
  const __ANIME4K_E2E__: boolean;
}

/** Canonical identifiers shared by storage, UI, WebGPU, and native messaging. */
type Anime4KMode = GeneratedAnime4KMode;
type AiUpscaleMode =
  | 'REALESRGAN';
type EnhancementMode = 'OFF' | Anime4KMode | AiUpscaleMode;
type QualityTier = GeneratedQualityTier;
type RenderBackend = 'auto' | 'webgpu' | 'native';

/**
 * RealESRGAN inference precision (intern, kein User-Setting mehr). Die
 * automatische Policy pro Gerät/EP wählt sie:
 * - native Vulkan-Host: fp16-Speicher (eigenes Modell, ignoriert das Feld),
 * - ORT-Worker (WebGPU): fp32-Referenz,
 * - Main-Thread-Session (WASM-Fallback): int8 (~1.8x, PSNR 32.5 dB).
 * fp16 bleibt vorerst aus: ORT-web 1.29 scheitert am Clip-WGSL-Bug und
 * würde pro Shape einen Timeout verbrennen. Der Typ bleibt als internes
 * Vokabular von Session/Worker/Stats erhalten.
 */
type RealEsrganPrecision = 'fp32' | 'fp16' | 'int8';

/** Legacy identifiers used only to migrate pre-1.0 settings. */
type PerformanceTier = 'performance' | 'balanced' | 'quality' | 'ultra';
type BaseMode = 'A' | 'B' | 'C' | 'A+A' | 'B+B' | 'C+A';

interface Anime4KWebExtSettings {
  extensionEnabled: boolean;
  mode: EnhancementMode;
  quality: QualityTier;
  backend: RenderBackend;
  statsEnabled: boolean;
  autoFullscreenEnabled: boolean;
  frameGenerationEnabled: boolean;
  /** RealESRGAN-Cap (nur REALESRGAN-Modus); andere Modi ignorieren das Feld. */
  realesrganCapHeight: RealEsrganCapHeight;
}

interface LocalSettings {
  hasCompletedOnboarding: boolean;
  /** Set when the user last completed onboarding under the per-site access model. */
  siteAccessModelAcknowledged: boolean;
  verboseLogging: boolean;
}

interface RenderStats {
  fps: number;
  renderMs: number;
  droppedFrames: number;
  warning: boolean;
  /**
   * Optional RealESRGAN phase timings (averaged over the same window as
   * `renderMs`). Only populated when the active pipeline implements
   * `Anime4KPipeline.getPhaseStats`; non-RealESRGAN pipelines omit them and
   * the overlay falls back to the basic FPS/renderMs line.
   */
  realesrgan?: RealEsrganPhaseStats;
  /**
   * Renderer frame budget in ms (adaptive to the measured presentation
   * interval). Present on WebGPU-renderer stats; lets consumers (Auto-Cap)
   * judge headroom against the same budget the overload warning uses.
   */
  frameBudgetMs?: number;
}

interface RealEsrganPhaseStats {
  readbackMs: number;
  inferMs: number;
  composeMs: number;
  runnerPct: number;
  gpuComposePct: number;
  /**
   * Share of frames served by the native Vulkan host (a subset of
   * runnerPct: the native client also runs through the worker slot).
   * Lets the overlay tell "native-gpu" apart from the ORT worker.
   */
  nativePct: number;
  precision?: RealEsrganPrecision;
  count: number;
  /** Derived by the renderer from its own stats window; the pipeline never sets it. */
  enhancedFps?: number;
}

interface VideoEnhancer {
  destroy: () => void;
  stopEnhancement: (options?: { stopNative?: boolean; releaseClaim?: boolean }) => Promise<void>;
  isActive: () => boolean;
  updateSettings: (settings: Anime4KWebExtSettings) => Promise<void>;
  getVideoElement: () => HTMLVideoElement;
  detach: () => void;
  reattach: (newVideo: HTMLVideoElement) => Promise<void>;
}

interface EnhancementEffect {
  id: string;
  name: string;
  className: string;
  params?: { [key: string]: unknown };
  upscaleFactor?: number;
  webgpuAvailable?: boolean;
  alwaysApply?: boolean;
}

interface Dimensions {
  width: number;
  height: number;
}

export {
  Anime4KMode,
  AiUpscaleMode,
  EnhancementMode,
  QualityTier,
  RenderBackend,
  RealEsrganCapHeight,
  RealEsrganPrecision,
  PerformanceTier,
  BaseMode,
  Anime4KWebExtSettings,
  LocalSettings,
  RenderStats,
  RealEsrganPhaseStats,
  VideoEnhancer,
  EnhancementEffect,
  Dimensions,
};
