import type {
  Anime4KWebExtSettings,
  EnhancementMode,
  EnhancementEffect,
  LocalSettings,
  QualityTier,
  RenderBackend,
} from '../types';
import { ID_TO_MODE, isEnhancementMode, isQualityTier } from '../shared/presets';
import { resolveEnhancementGraph } from './effect-chain-templates';
import { applyFreePlanLimits, hasStoredProLicense } from '../account/entitlement';

export const DEFAULT_SETTINGS: Anime4KWebExtSettings = {
  extensionEnabled: true,
  mode: 'A',
  quality: 'M',
  output: 'auto',
  backend: 'webgpu',
  statsEnabled: true,
  autoFullscreenEnabled: true,
  frameGenerationEnabled: false,
};

const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  hasCompletedOnboarding: false,
};

function isBackend(value: unknown): value is RenderBackend {
  return value === 'auto' || value === 'webgpu' || value === 'native';
}

export async function getSettings(): Promise<Anime4KWebExtSettings> {
  // selectedModeId is read only so a content script opened during a 0.x → 1.x
  // update can still choose the user's former built-in mode before migration.
  const data = await chrome.storage.sync.get([
    'extensionEnabled',
    'mode',
    'quality',
    'backend',
    'statsEnabled',
    'autoFullscreenEnabled',
    'frameGenerationEnabled',
    'selectedModeId',
  ]);
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
  };
  return await hasStoredProLicense() ? settings : applyFreePlanLimits(settings);
}

export async function getLocalSettings(): Promise<LocalSettings> {
  const data = await chrome.storage.local.get(['hasCompletedOnboarding']);
  return {
    hasCompletedOnboarding: typeof data.hasCompletedOnboarding === 'boolean'
      ? data.hasCompletedOnboarding
      : DEFAULT_LOCAL_SETTINGS.hasCompletedOnboarding,
  };
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
  update.output = 'auto';
  await storageSet(chrome.storage.sync, update as Record<string, unknown>);
}

export function getEffectsForPreset(mode: EnhancementMode, quality: QualityTier): EnhancementEffect[] {
  return resolveEnhancementGraph(mode, quality);
}
