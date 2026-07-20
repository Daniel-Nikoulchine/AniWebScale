import type { EnhancementMode, QualityTier, RenderBackend } from '../types';
import {
  ID_TO_MODE,
  isEnhancementMode,
  isQualityTier,
  legacyTierToQuality,
} from '../shared/presets';

const CURRENT_CONFIG_VERSION = 10;

const PREFERENCE_KEYS = [
  'extensionEnabled',
  'mode',
  'quality',
  'output',
  'backend',
  'statsEnabled',
  'autoFullscreenEnabled',
  'frameGenerationEnabled',
  'theme',
  '_configVersion',
];

function isBackend(value: unknown): value is RenderBackend {
  return value === 'auto' || value === 'webgpu' || value === 'native';
}

async function needsMigration(): Promise<boolean> {
  const data = await chrome.storage.local.get(['_configVersion']);
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
    statsEnabled: typeof syncData.statsEnabled === 'boolean' ? syncData.statsEnabled : false,
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
async function migrateV1ToV2(): Promise<void> {
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
      'theme',
      '_configVersion',
    ]),
    chrome.storage.local.get([
      ...PREFERENCE_KEYS,
      'performanceTier',
      'hasCompletedOnboarding',
    ]),
  ]);

  const sourceData = { ...syncData, ...localData };
  const normalized = normalizeLegacySettings(sourceData, localData);
  const theme = ['light', 'dark', 'auto'].includes(String(sourceData.theme))
    ? sourceData.theme
    : 'auto';

  await chrome.storage.local.set({
    extensionEnabled: normalized.extensionEnabled,
    mode: normalized.mode,
    quality: normalized.quality,
    output: 'auto',
    backend: normalized.backend,
    statsEnabled: normalized.statsEnabled,
    autoFullscreenEnabled: normalized.autoFullscreenEnabled,
    frameGenerationEnabled: normalized.frameGenerationEnabled,
    theme,
    hasCompletedOnboarding: normalized.hasCompletedOnboarding,
    _configVersion: CURRENT_CONFIG_VERSION,
  });

  await Promise.all([
    chrome.storage.sync.remove([
      ...PREFERENCE_KEYS,
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
