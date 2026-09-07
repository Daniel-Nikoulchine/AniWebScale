/// <reference types="@webgpu/types" />

import type {
  Anime4KMode as GeneratedAnime4KMode,
  QualityTier as GeneratedQualityTier,
} from './shared/generated-preset-graph';

declare global {
  /** Compile-time gate; false in every distributable build. */
  const __ANIME4K_E2E__: boolean;
}

/** Canonical identifiers shared by storage, UI, WebGPU, and native messaging. */
type Anime4KMode = GeneratedAnime4KMode;
type AiUpscaleMode =
  | 'CNNX2'
  | 'ARTCNN'
  | 'ACNET'
  | 'ARNET'
  | 'REALESRGAN';
type EnhancementMode = 'OFF' | Anime4KMode | AiUpscaleMode;
type QualityTier = GeneratedQualityTier;
type RenderBackend = 'auto' | 'webgpu' | 'native';
type OutputMode = 'auto';
/**
 * RealESRGAN inference cap heights (input px). Gemessene Leiter: 480, 432,
 * 405 plus 360 als Auto-Cap-Notrung. 405-gegen-360 liegt bei 38 dB PSNR auf
 * echtem Material (besser als der heutige 480-gegen-405-Schritt mit 35 dB),
 * also kein starker Qualitaetsverlust fuer die letzte Sprosse.
 */
type RealEsrganCapHeight = 480 | 432 | 405 | 360;

/**
 * RealESRGAN inference precision (nur REALESRGAN-Modus, nur Browser-Pfade).
 * int8: statisch quantisiertes QDQ-Modell, ~1.8x auf WASM, PSNR 32.5 dB.
 * Läuft nur auf der WASM-EP (keine QDQ-Kernels in ORT-web 1.29 WebGPU),
 * der Worker bleibt FP32. fp16: WebGPU, scheitert auf RDNA2 am
 * Clip-WGSL-Bug und fällt pro Worker-Leben einmalig auf FP32 zurück.
 * fp32: Referenzqualität überall. Der native Vulkan-Host hat sein Modell
 * fest verdrahtet und ignoriert das Feld.
 */
type RealEsrganPrecision = 'fp32' | 'fp16' | 'int8';

/** Legacy identifiers used only to migrate pre-1.0 settings. */
type PerformanceTier = 'performance' | 'balanced' | 'quality' | 'ultra';
type BaseMode = 'A' | 'B' | 'C' | 'A+A' | 'B+B' | 'C+A';

interface Anime4KWebExtSettings {
  extensionEnabled: boolean;
  mode: EnhancementMode;
  quality: QualityTier;
  output: OutputMode;
  backend: RenderBackend;
  statsEnabled: boolean;
  autoFullscreenEnabled: boolean;
  frameGenerationEnabled: boolean;
  /** RealESRGAN-Cap (nur REALESRGAN-Modus); andere Modi ignorieren das Feld. */
  realesrganCapHeight: RealEsrganCapHeight;
  /** RealESRGAN-Precision (nur REALESRGAN-Modus, nur Browser-Pfade). */
  realesrganPrecision: RealEsrganPrecision;
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
  getCurrentModeId: () => string | null;
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
  OutputMode,
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
