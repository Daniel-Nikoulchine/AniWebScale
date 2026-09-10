import type { EnhancementMode, QualityTier, RealEsrganCapHeight, RenderBackend } from '../types';
import type { LocalSettings } from '../types';
import { defaultForSettingKey } from '../utils/settings';
import { isRealEsrganCapHeight } from '../shared/realesrgan-auto-cap';
import { applySettings, type SettingsApplyResult, type SettingsUpdate } from '../utils/apply-settings';

export interface RenderControlElements {
  mode: HTMLSelectElement;
  quality: HTMLSelectElement;
  backend: HTMLSelectElement;
  realesrganCap?: HTMLSelectElement;
  statistics: HTMLInputElement;
  frameGeneration: HTMLInputElement;
}

function parseRealEsrganCap(value: string): RealEsrganCapHeight | null {
  const parsed = Number(value);
  return isRealEsrganCapHeight(parsed) ? parsed : null;
}

/** Built-in default per render/local key, used when a storage key is removed. */
export function defaultForKey(key: string): string | number | boolean | undefined {
  return defaultForSettingKey(key);
}

export function collectRenderSettings(controls: RenderControlElements): SettingsUpdate {
  const update: SettingsUpdate = {
    mode: controls.mode.value as EnhancementMode,
    quality: controls.quality.value as QualityTier,
    backend: controls.backend.value as RenderBackend,
    statsEnabled: controls.statistics.checked,
    frameGenerationEnabled: controls.frameGeneration.checked,
  };
  const cap = controls.realesrganCap ? parseRealEsrganCap(controls.realesrganCap.value) : null;
  if (cap !== null) update.realesrganCapHeight = cap;
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
  /** Override the success message for a specific update (e.g. the popup toggle). */
  appliedFor?: (update: SettingsUpdate) => string | undefined;
  messages?: {
    saving?: string;
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
    const update = options.collectSettings?.() ?? collectRenderSettings(options.controls);
    const result = await applySettings(
      update,
      { local: options.getLocalSettings?.() },
    ).catch(() => 'failed' as const);

    if (result === 'failed') options.showStatus(messages.failed);
    else if (result === 'saved-not-applied') options.showStatus(messages.savedNotApplied);
    else options.showStatus(options.appliedFor?.(update) ?? messages.applied);
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
