import type { Anime4KWebExtSettings, EnhancementMode, QualityTier } from '../types';
import {
  ID_TO_MODE,
  isEnhancementMode,
  isQualityTier,
  legacyTierToQuality,
} from '../shared/presets';
import { isRealEsrganCapHeight } from '../shared/realesrgan-auto-cap';
import { RENDER_SETTING_KEYS } from './settings-change';
import { readSetting } from './settings';
import { readTheme } from './local-settings';

// 12: dropped the stored RealESRGAN precision (auto-selected per device/EP).
const CURRENT_CONFIG_VERSION = 12;

/**
 * The migration's one key inventory: which keys to read from each surface and
 * which legacy keys to purge. Derived from the render-setting source of truth
 * plus the non-render keys the migration still carries across config versions.
 */
const MIGRATION_KEYS = {
  sync: [...RENDER_SETTING_KEYS, 'selectedModeId', 'theme', '_configVersion'],
  local: [
    ...RENDER_SETTING_KEYS,
    'selectedModeId',
    'theme',
    '_configVersion',
    'performanceTier',
    'hasCompletedOnboarding',
    'siteAccessModelAcknowledged',
    'uiLanguage',
    'verboseLogging',
  ],
  syncRemoval: [
    ...RENDER_SETTING_KEYS,
    'selectedModeId',
    'theme',
    '_configVersion',
    // Vestigial output setting: nothing reads it, purge it on upgrade.
    'output',
    'targetResolutionSetting',
    'whitelistEnabled',
    'whitelist',
    'customModes',
    'enableCrossOriginFix',
    'enhancementModes',
    // v12: the precision became device/EP-auto, not a stored preference.
    'realesrganPrecision',
  ],
  localRemoval: [
    'performanceTier',
    'gpuBenchmarkResult',
    '_benchmarkInProgress',
    'selectedModeId',
    // v12: purge the legacy stored precision on both surfaces.
    'realesrganPrecision',
  ],
} as const;

export interface NormalizedLegacySettings extends Anime4KWebExtSettings {
  hasCompletedOnboarding: boolean;
  siteAccessModelAcknowledged: boolean;
}

async function needsMigration(): Promise<boolean> {
  const data = await chrome.storage.local.get(['_configVersion']);
  return (data._configVersion ?? 0) < CURRENT_CONFIG_VERSION;
}

export function normalizeLegacySettings(
  syncData: Record<string, unknown>,
  localData: Record<string, unknown>,
): NormalizedLegacySettings {
  const mode: EnhancementMode = isEnhancementMode(syncData.mode)
    ? syncData.mode
    : ID_TO_MODE[String(syncData.selectedModeId ?? '')] ?? readSetting(syncData, 'mode');
  const quality: QualityTier = isQualityTier(syncData.quality)
    ? syncData.quality
    : localData.performanceTier
      ? legacyTierToQuality(localData.performanceTier)
      : readSetting(syncData, 'quality');
  return {
    extensionEnabled: readSetting(syncData, 'extensionEnabled'),
    mode,
    quality,
    backend: readSetting(syncData, 'backend'),
    statsEnabled: readSetting(syncData, 'statsEnabled'),
    autoFullscreenEnabled: readSetting(syncData, 'autoFullscreenEnabled'),
    frameGenerationEnabled: readSetting(syncData, 'frameGenerationEnabled'),
    // Overlapping keys prefer the merged/sync value (see the sourceData spread
    // in migrateToCurrentConfig): a stale local copy must not clobber it.
    realesrganCapHeight: isRealEsrganCapHeight(syncData.realesrganCapHeight)
      ? syncData.realesrganCapHeight
      : isRealEsrganCapHeight(localData.realesrganCapHeight)
        ? localData.realesrganCapHeight
        : readSetting(syncData, 'realesrganCapHeight'),
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
async function migrateToCurrentConfig(): Promise<void> {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get([...MIGRATION_KEYS.sync]),
    chrome.storage.local.get([...MIGRATION_KEYS.local]),
  ]);

  // Overlapping keys prefer the sync value when present: chrome.sync holds
  // the last writer across devices, while a local copy may be a stale
  // device default that would otherwise clobber the newer synced choice.
  // chrome.storage.get only returns stored keys, so a missing sync key
  // cleanly falls back to the local value.
  const sourceData = { ...localData, ...syncData };
  const normalized = normalizeLegacySettings(sourceData, localData);
  const theme = readTheme(sourceData);

  await chrome.storage.local.set({
    extensionEnabled: normalized.extensionEnabled,
    mode: normalized.mode,
    quality: normalized.quality,
    backend: normalized.backend,
    statsEnabled: normalized.statsEnabled,
    autoFullscreenEnabled: normalized.autoFullscreenEnabled,
    frameGenerationEnabled: normalized.frameGenerationEnabled,
    realesrganCapHeight: normalized.realesrganCapHeight,
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
    chrome.storage.sync.remove([...MIGRATION_KEYS.syncRemoval]),
    chrome.storage.local.remove([...MIGRATION_KEYS.localRemoval]),
  ]);
}

export async function ensureLatestConfig(): Promise<void> {
  if (await needsMigration()) await migrateToCurrentConfig();
}
