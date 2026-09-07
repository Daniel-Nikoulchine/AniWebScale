import type {
  Anime4KWebExtSettings,
  EnhancementMode,
  EnhancementEffect,
  LocalSettings,
  QualityTier,
  RealEsrganCapHeight,
  RealEsrganPrecision,
  RenderBackend,
} from '../types';
import { ID_TO_MODE, isEnhancementMode, isQualityTier } from '../shared/presets';
import { resolveEnhancementGraph } from './effect-chain-templates';
import { RENDER_SETTING_KEYS } from './settings-change';

export const DEFAULT_SETTINGS: Anime4KWebExtSettings = {
  extensionEnabled: true,
  mode: 'A',
  quality: 'M',
  output: 'auto',
  // Auto prefers WebGPU and falls back to the native host (protected
  // playback, missing WebGPU). A forced 'webgpu' default would strand those
  // cases with an error instead of falling back; migration uses the same.
  backend: 'auto',
  statsEnabled: false,
  autoFullscreenEnabled: true,
  frameGenerationEnabled: false,
  realesrganCapHeight: 480,
  realesrganPrecision: 'int8',
};

function isBackend(value: unknown): value is RenderBackend {
  return value === 'auto' || value === 'webgpu' || value === 'native';
}

function isRealEsrganCapHeight(value: unknown): value is RealEsrganCapHeight {
  return value === 480 || value === 432 || value === 405 || value === 360;
}

function isRealEsrganPrecision(value: unknown): value is RealEsrganPrecision {
  return value === 'fp32' || value === 'fp16' || value === 'int8';
}

export async function getSettings(): Promise<Anime4KWebExtSettings> {
  // selectedModeId is read only so a content script opened during a 0.x → 1.x
  // update can still choose the user's former built-in mode before migration.
  const data = await chrome.storage.local.get([...RENDER_SETTING_KEYS]);
  const mode = isEnhancementMode(data.mode)
    ? data.mode
    : ID_TO_MODE[data.selectedModeId] ?? DEFAULT_SETTINGS.mode;
  const settings: Anime4KWebExtSettings = {
    extensionEnabled: typeof data.extensionEnabled === 'boolean'
      ? data.extensionEnabled
      : DEFAULT_SETTINGS.extensionEnabled,
    mode,
    quality: isQualityTier(data.quality) ? data.quality : DEFAULT_SETTINGS.quality,
    output: 'auto',
    backend: isBackend(data.backend) ? data.backend : DEFAULT_SETTINGS.backend,
    statsEnabled: typeof data.statsEnabled === 'boolean' ? data.statsEnabled : DEFAULT_SETTINGS.statsEnabled,
    autoFullscreenEnabled: typeof data.autoFullscreenEnabled === 'boolean'
      ? data.autoFullscreenEnabled
      : DEFAULT_SETTINGS.autoFullscreenEnabled,
    frameGenerationEnabled: typeof data.frameGenerationEnabled === 'boolean'
      ? data.frameGenerationEnabled
      : DEFAULT_SETTINGS.frameGenerationEnabled,
    realesrganCapHeight: isRealEsrganCapHeight(data.realesrganCapHeight)
      ? data.realesrganCapHeight
      : DEFAULT_SETTINGS.realesrganCapHeight,
    realesrganPrecision: isRealEsrganPrecision(data.realesrganPrecision)
      ? data.realesrganPrecision
      : DEFAULT_SETTINGS.realesrganPrecision,
  };
  return settings;
}

function storageSet(area: chrome.storage.StorageArea, values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

export async function saveLocalSettings(settings: Partial<LocalSettings>): Promise<void> {
  await storageSet(chrome.storage.local, settings as Record<string, unknown>);
}

export async function saveSettings(settings: Partial<Anime4KWebExtSettings>): Promise<void> {
  const update: Partial<Anime4KWebExtSettings> = {};
  if (typeof settings.extensionEnabled === 'boolean') update.extensionEnabled = settings.extensionEnabled;
  if (isEnhancementMode(settings.mode)) update.mode = settings.mode;
  if (isQualityTier(settings.quality)) update.quality = settings.quality;
  if (isBackend(settings.backend)) update.backend = settings.backend;
  if (typeof settings.statsEnabled === 'boolean') update.statsEnabled = settings.statsEnabled;
  if (typeof settings.autoFullscreenEnabled === 'boolean') {
    update.autoFullscreenEnabled = settings.autoFullscreenEnabled;
  }
  if (typeof settings.frameGenerationEnabled === 'boolean') {
    update.frameGenerationEnabled = settings.frameGenerationEnabled;
  }
  if (isRealEsrganCapHeight(settings.realesrganCapHeight)) {
    update.realesrganCapHeight = settings.realesrganCapHeight;
  }
  if (isRealEsrganPrecision(settings.realesrganPrecision)) {
    update.realesrganPrecision = settings.realesrganPrecision;
  }
  // The output model is fixed to 'auto'; only persist it alongside a real
  // change so an empty update cannot emit a spurious render-key change that
  // re-applies every managed enhancer for nothing.
  if (Object.keys(update).length > 0) update.output = 'auto';
  if (Object.keys(update).length === 0) return;
  await storageSet(chrome.storage.local, update as Record<string, unknown>);
}

export function getEffectsForPreset(
  mode: EnhancementMode,
  quality: QualityTier,
  realesrganCapHeight: RealEsrganCapHeight = DEFAULT_SETTINGS.realesrganCapHeight,
  realesrganPrecision: RealEsrganPrecision = DEFAULT_SETTINGS.realesrganPrecision,
): EnhancementEffect[] {
  return resolveEnhancementGraph(mode, quality, realesrganCapHeight, realesrganPrecision);
}
