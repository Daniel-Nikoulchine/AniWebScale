import type { EnhancementMode, QualityTier, RealEsrganCapHeight, RealEsrganPrecision, RenderBackend } from '../types';
import {
  ID_TO_MODE,
  isEnhancementMode,
  isQualityTier,
  legacyTierToQuality,
} from '../shared/presets';
import { RENDER_SETTING_KEYS } from './settings-change';

const CURRENT_CONFIG_VERSION = 11;

/**
 * Every preference key the migration pass preserves. Derived from the render
 * setting keys (the source of truth for what content scripts watch) plus the
 * non-render keys the migration still carries across config versions.
 */
const PREFERENCE_KEYS = new Set<string>([
  ...RENDER_SETTING_KEYS,
  'theme',
  '_configVersion',
]);

function isBackend(value: unknown): value is RenderBackend {
  return value === 'auto' || value === 'webgpu' || value === 'native';
}

function isCapHeight(value: unknown): value is RealEsrganCapHeight {
  return value === 480 || value === 432 || value === 405 || value === 360;
}

function isPrecision(value: unknown): value is RealEsrganPrecision {
  return value === 'fp32' || value === 'fp16' || value === 'int8';
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
  realesrganCapHeight: RealEsrganCapHeight;
  realesrganPrecision: RealEsrganPrecision;
  hasCompletedOnboarding: boolean;
  siteAccessModelAcknowledged: boolean;
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
    realesrganCapHeight: isCapHeight(localData.realesrganCapHeight)
      ? localData.realesrganCapHeight
      : isCapHeight(syncData.realesrganCapHeight)
        ? syncData.realesrganCapHeight
        : 480,
    realesrganPrecision: isPrecision(localData.realesrganPrecision)
      ? localData.realesrganPrecision
      : isPrecision(syncData.realesrganPrecision)
        ? syncData.realesrganPrecision
        : 'int8',
    hasCompletedOnboarding: typeof localData.hasCompletedOnboarding === 'boolean'
      ? localData.hasCompletedOnboarding
      : false,
    // shouldReopenOnboarding() requires both flags. Older installs predate
    // the per-site access model and never stored the ack; dropping it here
    // would reopen onboarding for every updating user.
    siteAccessModelAcknowledged: typeof localData.siteAccessModelAcknowledged === 'boolean'
      ? localData.siteAccessModelAcknowledged
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
      'output',
      'backend',
      'statsEnabled',
      'autoFullscreenEnabled',
      'frameGenerationEnabled',
      'realesrganCapHeight',
      'selectedModeId',
      'theme',
      '_configVersion',
    ]),
    chrome.storage.local.get([
      ...PREFERENCE_KEYS,
      'performanceTier',
      'hasCompletedOnboarding',
      'siteAccessModelAcknowledged',
      'uiLanguage',
      'verboseLogging',
    ]),
  ]);

  // Overlapping keys prefer the sync value when present: chrome.sync holds
  // the last writer across devices, while a local copy may be a stale
  // device default that would otherwise clobber the newer synced choice.
  // chrome.storage.get only returns stored keys, so a missing sync key
  // cleanly falls back to the local value.
  const sourceData = { ...localData, ...syncData };
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
    realesrganCapHeight: normalized.realesrganCapHeight,
    realesrganPrecision: normalized.realesrganPrecision,
    theme,
    hasCompletedOnboarding: normalized.hasCompletedOnboarding,
    siteAccessModelAcknowledged: normalized.siteAccessModelAcknowledged,
    uiLanguage: sourceData.uiLanguage === 'en' || sourceData.uiLanguage === 'de'
      ? sourceData.uiLanguage
      : 'auto',
    verboseLogging: sourceData.verboseLogging === true,
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
