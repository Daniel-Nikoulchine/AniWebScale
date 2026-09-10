import type {
  Anime4KWebExtSettings,
  EnhancementMode,
  EnhancementEffect,
  LocalSettings,
  QualityTier,
  RenderBackend,
} from '../types';
import {
  DEFAULT_REALESRGAN_CAP_HEIGHT,
  ID_TO_MODE,
  isEnhancementMode,
  isQualityTier,
} from '../shared/presets';
import { isRealEsrganCapHeight } from '../shared/realesrgan-auto-cap';
import { resolveEnhancementGraph } from './effect-chain-templates';
import { RENDER_SETTING_KEYS } from './settings-change';

function isBackend(value: unknown): value is RenderBackend {
  return value === 'auto' || value === 'webgpu' || value === 'native';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

interface SettingField<T> {
  readonly default: T;
  readonly is: (value: unknown) => boolean;
}

/**
 * The single field -> { guard, default } table behind every settings read and
 * write. `DEFAULT_SETTINGS` is derived from it; `saveSettings` filters through
 * the same guards, so a new field cannot drift between the two paths.
 */
export const SETTINGS_SCHEMA: {
  readonly [K in keyof Anime4KWebExtSettings]: SettingField<Anime4KWebExtSettings[K]>;
} = {
  extensionEnabled: { default: true, is: isBoolean },
  mode: { default: 'A' as EnhancementMode, is: isEnhancementMode },
  quality: { default: 'M' as QualityTier, is: isQualityTier },
  // Auto prefers WebGPU and falls back to the native host (protected
  // playback, missing WebGPU). A forced 'webgpu' default would strand those
  // cases with an error instead of falling back; migration uses the same.
  backend: { default: 'auto' as RenderBackend, is: isBackend },
  statsEnabled: { default: false, is: isBoolean },
  autoFullscreenEnabled: { default: true, is: isBoolean },
  frameGenerationEnabled: { default: false, is: isBoolean },
  realesrganCapHeight: { default: DEFAULT_REALESRGAN_CAP_HEIGHT, is: isRealEsrganCapHeight },
};

export const DEFAULT_SETTINGS: Anime4KWebExtSettings = {
  extensionEnabled: SETTINGS_SCHEMA.extensionEnabled.default,
  mode: SETTINGS_SCHEMA.mode.default,
  quality: SETTINGS_SCHEMA.quality.default,
  backend: SETTINGS_SCHEMA.backend.default,
  statsEnabled: SETTINGS_SCHEMA.statsEnabled.default,
  autoFullscreenEnabled: SETTINGS_SCHEMA.autoFullscreenEnabled.default,
  frameGenerationEnabled: SETTINGS_SCHEMA.frameGenerationEnabled.default,
  realesrganCapHeight: SETTINGS_SCHEMA.realesrganCapHeight.default,
};

/** Read one guarded field from an arbitrary storage-shaped record. */
export function readSetting<K extends keyof Anime4KWebExtSettings>(
  data: Record<string, unknown>,
  key: K,
): Anime4KWebExtSettings[K] {
  const field = SETTINGS_SCHEMA[key];
  const raw = data[key];
  return (field.is(raw) ? raw : field.default) as Anime4KWebExtSettings[K];
}

/** The stored default for a render/local key, used when storage drops it. */
export function defaultForSettingKey(key: string): string | number | boolean | undefined {
  if (key in SETTINGS_SCHEMA) {
    return SETTINGS_SCHEMA[key as keyof Anime4KWebExtSettings].default;
  }
  if (key === 'verboseLogging') return false;
  return undefined;
}

/**
 * Read the render settings from local storage. `selectedModeId` is read only
 * so a content script opened during a 0.x → 1.x update can still choose the
 * user's former built-in mode before migration.
 */
export async function getSettings(): Promise<Anime4KWebExtSettings> {
  const data = await chrome.storage.local.get([...RENDER_SETTING_KEYS, 'selectedModeId']);
  const mode: EnhancementMode = isEnhancementMode(data.mode)
    ? data.mode
    : ID_TO_MODE[String(data.selectedModeId ?? '')] ?? SETTINGS_SCHEMA.mode.default;
  return {
    extensionEnabled: readSetting(data, 'extensionEnabled'),
    mode,
    quality: readSetting(data, 'quality'),
    backend: readSetting(data, 'backend'),
    statsEnabled: readSetting(data, 'statsEnabled'),
    autoFullscreenEnabled: readSetting(data, 'autoFullscreenEnabled'),
    frameGenerationEnabled: readSetting(data, 'frameGenerationEnabled'),
    realesrganCapHeight: readSetting(data, 'realesrganCapHeight'),
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
  const update: Record<string, unknown> = {};
  for (const key of Object.keys(SETTINGS_SCHEMA) as (keyof Anime4KWebExtSettings)[]) {
    const field = SETTINGS_SCHEMA[key];
    const value = settings[key];
    if (field.is(value)) update[key] = value;
  }
  if (Object.keys(update).length === 0) return;
  await storageSet(chrome.storage.local, update);
}

export function getEffectsForPreset(
  mode: EnhancementMode,
  quality: QualityTier,
  realesrganCapHeight = DEFAULT_SETTINGS.realesrganCapHeight,
): EnhancementEffect[] {
  return resolveEnhancementGraph(mode, quality, realesrganCapHeight);
}
