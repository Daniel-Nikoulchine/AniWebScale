import type { EnhancementMode, QualityTier, RenderBackend } from '../types';
import {
  ID_TO_MODE,
  isEnhancementMode,
  isQualityTier,
  legacyTierToQuality,
} from '../shared/presets';

const CURRENT_CONFIG_VERSION = 9;

function isBackend(value: unknown): value is RenderBackend {
  return value === 'auto' || value === 'webgpu' || value === 'native';
}

export async function needsMigration(): Promise<boolean> {
  const data = await chrome.storage.sync.get(['_configVersion']);
  return (data._configVersion ?? 0) < CURRENT_CONFIG_VERSION;
}

export function normalizeLegacySettings(
  syncData: Record<string, unknown>,
  localData: Record<string, unknown>,
): {
  extensionEnabled: boolean;
  mode: EnhancementMode;
  quality: QualityTier;
  output: 'auto';
  backend: RenderBackend;
  statsEnabled: boolean;
  autoFullscreenEnabled: boolean;
  frameGenerationEnabled: boolean;
  hasCompletedOnboarding: boolean;
} {
  const mode: EnhancementMode = isEnhancementMode(syncData.mode)
    ? syncData.mode
    : ID_TO_MODE[String(syncData.selectedModeId ?? '')] ?? 'A';
  const quality: QualityTier = isQualityTier(syncData.quality)
    ? syncData.quality
    : localData.performanceTier
      ? legacyTierToQuality(localData.performanceTier)
      : 'M';
  return {
    extensionEnabled: typeof syncData.extensionEnabled === 'boolean'
      ? syncData.extensionEnabled
      : true,
    mode,
    quality,
    output: 'auto',
    backend: isBackend(syncData.backend) ? syncData.backend : 'auto',
    statsEnabled: typeof syncData.statsEnabled === 'boolean' ? syncData.statsEnabled : true,
    autoFullscreenEnabled: typeof syncData.autoFullscreenEnabled === 'boolean'
      ? syncData.autoFullscreenEnabled
      : true,
    frameGenerationEnabled: typeof syncData.frameGenerationEnabled === 'boolean'
      ? syncData.frameGenerationEnabled
      : false,
    hasCompletedOnboarding: typeof localData.hasCompletedOnboarding === 'boolean'
      ? localData.hasCompletedOnboarding
      : false,
  };
}

/**
 * Upgrade every legacy layout to the fixed official-preset model. This also
 * permanently disables the former CORS-header and source-reload workaround.
 */
export async function migrateV1ToV2(): Promise<void> {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get([
      'extensionEnabled',
      'mode',
      'quality',
      'backend',
      'statsEnabled',
      'autoFullscreenEnabled',
      'frameGenerationEnabled',
      'selectedModeId',
    ]),
    chrome.storage.local.get(['performanceTier', 'hasCompletedOnboarding']),
  ]);

  const normalized = normalizeLegacySettings(syncData, localData);

  await Promise.all([
    chrome.storage.sync.set({
      extensionEnabled: normalized.extensionEnabled,
      mode: normalized.mode,
      quality: normalized.quality,
      output: 'auto',
      backend: normalized.backend,
      statsEnabled: normalized.statsEnabled,
      autoFullscreenEnabled: normalized.autoFullscreenEnabled,
      frameGenerationEnabled: normalized.frameGenerationEnabled,
      _configVersion: CURRENT_CONFIG_VERSION,
    }),
    chrome.storage.local.set({
      hasCompletedOnboarding: normalized.hasCompletedOnboarding,
    }),
  ]);

  await Promise.all([
    chrome.storage.sync.remove([
      'selectedModeId',
      'targetResolutionSetting',
      'whitelistEnabled',
      'whitelist',
      'customModes',
      'enableCrossOriginFix',
      'enhancementModes',
    ]),
    chrome.storage.local.remove(['performanceTier', 'gpuBenchmarkResult', '_benchmarkInProgress']),
  ]);
}

export async function ensureLatestConfig(): Promise<void> {
  if (await needsMigration()) await migrateV1ToV2();
}
