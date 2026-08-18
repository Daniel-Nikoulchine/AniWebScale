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
  | 'ARNET';
type EnhancementMode = 'OFF' | Anime4KMode | AiUpscaleMode;
type QualityTier = GeneratedQualityTier;
type RenderBackend = 'auto' | 'webgpu' | 'native';
type OutputMode = 'auto';

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
  PerformanceTier,
  BaseMode,
  Anime4KWebExtSettings,
  LocalSettings,
  RenderStats,
  VideoEnhancer,
  EnhancementEffect,
  Dimensions,
};
