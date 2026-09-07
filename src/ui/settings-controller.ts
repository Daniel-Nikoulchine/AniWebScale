import type { EnhancementMode, QualityTier, RealEsrganCapHeight, RealEsrganPrecision, RenderBackend } from '../types';
import type { LocalSettings } from '../types';
import { DEFAULT_SETTINGS } from '../utils/settings';
import { applySettings, type SettingsApplyResult, type SettingsUpdate } from '../utils/apply-settings';

export interface RenderControlElements {
  mode: HTMLSelectElement;
  quality: HTMLSelectElement;
  backend: HTMLSelectElement;
  realesrganCap?: HTMLSelectElement;
  realesrganPrecision?: HTMLSelectElement;
  statistics: HTMLInputElement;
  frameGeneration: HTMLInputElement;
}

function parseRealEsrganCap(value: string): RealEsrganCapHeight | null {
  const parsed = Number(value);
  return parsed === 480 || parsed === 432 || parsed === 405 || parsed === 360 ? parsed : null;
}

function parseRealEsrganPrecision(value: string): RealEsrganPrecision | null {
  return value === 'fp32' || value === 'fp16' || value === 'int8' ? value : null;
}

/** Built-in default per render/local key, used when a storage key is removed. */
function defaultForKey(key: string): string | number | boolean | undefined {
  switch (key) {
    case 'mode': return DEFAULT_SETTINGS.mode;
    case 'quality': return DEFAULT_SETTINGS.quality;
    case 'backend': return DEFAULT_SETTINGS.backend;
    case 'realesrganCapHeight': return DEFAULT_SETTINGS.realesrganCapHeight;
    case 'realesrganPrecision': return DEFAULT_SETTINGS.realesrganPrecision;
    case 'statsEnabled': return DEFAULT_SETTINGS.statsEnabled;
    case 'frameGenerationEnabled': return DEFAULT_SETTINGS.frameGenerationEnabled;
    case 'extensionEnabled': return DEFAULT_SETTINGS.extensionEnabled;
    case 'autoFullscreenEnabled': return DEFAULT_SETTINGS.autoFullscreenEnabled;
    case 'verboseLogging': return false;
    default: return undefined;
  }
}

export function collectRenderSettings(controls: RenderControlElements): SettingsUpdate {
  const update: SettingsUpdate = {
    mode: controls.mode.value as EnhancementMode,
    quality: controls.quality.value as QualityTier,
    output: 'auto',
    backend: controls.backend.value as RenderBackend,
    statsEnabled: controls.statistics.checked,
    frameGenerationEnabled: controls.frameGeneration.checked,
  };
  const cap = controls.realesrganCap ? parseRealEsrganCap(controls.realesrganCap.value) : null;
  if (cap !== null) update.realesrganCapHeight = cap;
  const precision = controls.realesrganPrecision ? parseRealEsrganPrecision(controls.realesrganPrecision.value) : null;
  if (precision !== null) update.realesrganPrecision = precision;
  return update;
}

/** Apply storage changes to matching form controls and report whether the UI changed. */
export function syncRenderSettings(
  changes: { [key: string]: chrome.storage.StorageChange },
  controls: RenderControlElements,
  localBindings: Record<string, HTMLInputElement> = {},
): boolean {
  let changed = false;
  const selectBindings: Record<string, HTMLSelectElement> = {
    mode: controls.mode,
    quality: controls.quality,
    backend: controls.backend,
  };
  if (controls.realesrganCap) selectBindings.realesrganCapHeight = controls.realesrganCap;
  if (controls.realesrganPrecision) selectBindings.realesrganPrecision = controls.realesrganPrecision;
  const booleanBindings: Record<string, HTMLInputElement> = {
    statsEnabled: controls.statistics,
    frameGenerationEnabled: controls.frameGeneration,
    ...localBindings,
  };

  for (const [key, select] of Object.entries(selectBindings)) {
    const change = changes[key];
    // A removed key (e.g. after storage cleanup) carries newValue undefined:
    // fall back to the built-in default instead of keeping a stale display.
    const rawValue = change?.newValue
      ?? (change && 'newValue' in change && change.newValue === undefined
        ? defaultForKey(key)
        : undefined);
    const value = rawValue;
    // String() because the cap travels as a number (480) while option
    // values are strings ("480").
    if ((typeof value === 'string' || typeof value === 'number') && select.value !== String(value)) {
      const next = String(value);
      // A corrupt stored value matches no option; assigning it would leave
      // the select blank. Keep the current display instead.
      if (Array.from(select.options).some(option => option.value === next)) {
        select.value = next;
        changed = true;
      }
    }
  }
  for (const [key, input] of Object.entries(booleanBindings)) {
    const change = changes[key];
    const value = change?.newValue
      ?? (change && 'newValue' in change && change.newValue === undefined
        ? defaultForKey(key)
        : undefined);
    if (typeof value === 'boolean' && input.checked !== value) {
      input.checked = value;
      changed = true;
    }
  }
  return changed;
}

export interface SettingsControllerOptions {
  controls: RenderControlElements;
  additionalControls?: HTMLElement[];
  collectSettings?: () => SettingsUpdate;
  getLocalSettings?: () => Partial<LocalSettings>;
  onChange?: () => void;
  showStatus: (text: string) => void;
  messages?: {
    saving?: string;
    saved?: string;
    applied?: string;
    savedNotApplied?: string;
    failed?: string;
  };
}

export interface SettingsController {
  collectSettings: () => SettingsUpdate;
  saveNow: () => Promise<SettingsApplyResult>;
  scheduleSave: () => void;
}

const defaultMessages = {
  saving: 'Saving...',
  saved: 'Settings saved.',
  applied: 'Settings saved and applied.',
  savedNotApplied: 'Settings saved, but could not be applied.',
  failed: 'Could not save settings.',
};

export function createSettingsController(options: SettingsControllerOptions): SettingsController {
  const messages = { ...defaultMessages, ...options.messages };
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  async function saveNow(): Promise<SettingsApplyResult> {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    options.showStatus(messages.saving);
    const result = await applySettings(
      options.collectSettings?.() ?? collectRenderSettings(options.controls),
      { local: options.getLocalSettings?.() },
    ).catch(() => 'failed' as const);

    if (result === 'failed') options.showStatus(messages.failed);
    else if (result === 'saved-not-applied') options.showStatus(messages.savedNotApplied);
    else options.showStatus(result === 'applied' ? messages.applied : messages.saved);
    return result;
  }

  function scheduleSave(): void {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      void saveNow();
    }, 300);
  }

  // A debounced change must not be lost when the popup closes or the options
  // tab navigates away before the timer fires.
  window.addEventListener('pagehide', () => {
    if (saveTimer !== undefined) void saveNow();
  });

  const controls = [
    options.controls.mode,
    options.controls.quality,
    options.controls.backend,
    options.controls.statistics,
    options.controls.frameGeneration,
    ...(options.controls.realesrganCap ? [options.controls.realesrganCap] : []),
    ...(options.controls.realesrganPrecision ? [options.controls.realesrganPrecision] : []),
    ...(options.additionalControls ?? []),
  ];
  for (const control of controls) {
    control.addEventListener('change', () => {
      options.onChange?.();
      scheduleSave();
    });
  }

  return {
    collectSettings: () => options.collectSettings?.() ?? collectRenderSettings(options.controls),
    saveNow,
    scheduleSave,
  };
}
