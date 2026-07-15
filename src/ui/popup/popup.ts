import './popup.css';
import '../common-vars.css';
import type { Anime4KWebExtSettings, EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  isOnnxUpscaleMode,
  modeUsesQuality,
  supportsOnnxWebGpuRuntime,
} from '../../shared/presets';
import { getSettings, saveSettings } from '../../utils/settings';
import { populateModeSelect, renderModeDescription } from '../mode-select';
import { themeManager } from '../theme-manager';
import type { AccountStatus } from '../../account/entitlement';
import { isProMode, requiresProConfiguration } from '../../account/entitlement';

document.addEventListener('DOMContentLoaded', async () => {
  themeManager.getTheme();
  document.documentElement.lang = 'en';

  const mode = document.getElementById('mode') as HTMLSelectElement;
  const modeDescription = document.getElementById('mode-description') as HTMLParagraphElement;
  const extensionEnabled = document.getElementById('extension-enabled') as HTMLInputElement;
  const quality = document.getElementById('quality') as HTMLSelectElement;
  const backend = document.getElementById('backend') as HTMLSelectElement;
  const statistics = document.getElementById('statistics') as HTMLInputElement;
  const autoFullscreen = document.getElementById('auto-fullscreen') as HTMLInputElement;
  const frameGeneration = document.getElementById('frame-generation') as HTMLInputElement;
  const save = document.getElementById('save') as HTMLButtonElement;
  const openOptions = document.getElementById('open-options') as HTMLButtonElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const version = document.getElementById('version') as HTMLSpanElement;
  const accountPlan = document.getElementById('account-plan') as HTMLButtonElement;
  let hasPro = false;

  version.textContent = chrome.runtime.getManifest().version;
  const settings = await getSettings();
  extensionEnabled.checked = settings.extensionEnabled;
  populateModeSelect(mode, settings.mode);
  quality.value = settings.quality;
  backend.value = settings.backend;
  statistics.checked = settings.statsEnabled;
  autoFullscreen.checked = settings.autoFullscreenEnabled;
  frameGeneration.checked = settings.frameGenerationEnabled;

  const notifySettingsUpdated = async (update: Partial<Anime4KWebExtSettings>): Promise<void> => {
    const response = await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: update }) as
      { ok?: boolean; message?: string } | undefined;
    if (response?.ok === false) throw new Error(response.message || 'The active renderer rejected the settings.');
  };

  extensionEnabled.addEventListener('change', async () => {
    const enabled = extensionEnabled.checked;
    extensionEnabled.disabled = true;
    status.textContent = enabled ? 'Enabling extension...' : 'Disabling extension...';
    let settingsSaved = false;
    try {
      const update = { extensionEnabled: enabled };
      await saveSettings(update);
      settingsSaved = true;
      await notifySettingsUpdated(update);
      status.textContent = enabled ? 'Extension enabled.' : 'Extension disabled.';
    } catch (error) {
      console.error('[AniWebScale] Could not change extension status:', error);
      if (!settingsSaved) extensionEnabled.checked = !enabled;
      status.textContent = settingsSaved
        ? 'Extension status saved, but could not be applied.'
        : 'Could not change extension status.';
    } finally {
      extensionEnabled.disabled = false;
    }
  });

  const accountResponse = await chrome.runtime.sendMessage({ type: 'ACCOUNT_STATUS', refresh: false }) as
    { ok?: boolean; account?: AccountStatus } | undefined;
  const account = accountResponse?.account;
  hasPro = Boolean(account
    && (account.plan === 'pro' || account.plan === 'lifetime')
    && (account.status === 'active' || account.status === 'trialing'));
  const planLabel = account?.plan === 'lifetime' ? 'Lifetime Pro' : hasPro ? 'Pro' : 'Free';
  const label = accountPlan.querySelector('strong');
  if (label) label.textContent = planLabel;
  accountPlan.addEventListener('click', () => chrome.runtime.openOptionsPage());

  const refreshModeUi = () => {
    const selectedMode = mode.value as EnhancementMode;
    const processingDisabled = !isProcessingEnabled(selectedMode, frameGeneration.checked);
    const onnxSupported = supportsOnnxWebGpuRuntime();
    mode.querySelectorAll('option').forEach(option => {
      const value = (option as HTMLOptionElement).value as EnhancementMode;
      if (isProMode(value)) {
        (option as HTMLOptionElement).disabled = !hasPro
          || (value === 'ANIMEJANAI' && backend.value === 'webgpu' && !onnxSupported);
      }
    });
    Array.from(backend.options).forEach(option => {
      if (option.value !== 'webgpu') option.disabled = !hasPro;
    });
    if (!hasPro && backend.value !== 'webgpu') backend.value = 'webgpu';
    frameGeneration.disabled = !hasPro;
    if (!hasPro) frameGeneration.checked = false;
    renderModeDescription(selectedMode, modeDescription);
    quality.disabled = !modeUsesQuality(selectedMode);
    backend.disabled = processingDisabled;
  };
  mode.addEventListener('change', refreshModeUi);
  frameGeneration.addEventListener('change', refreshModeUi);
  backend.addEventListener('change', refreshModeUi);
  refreshModeUi();

  save.addEventListener('click', async () => {
    if (isOnnxUpscaleMode(mode.value as EnhancementMode)
      && backend.value === 'webgpu' && !supportsOnnxWebGpuRuntime()) {
      status.textContent = 'ONNX AI upscaling cannot use WebGPU in Firefox. Select Auto or Native.';
      return;
    }
    if (!hasPro && requiresProConfiguration({
      mode: mode.value as EnhancementMode,
      backend: backend.value as RenderBackend,
      frameGenerationEnabled: frameGeneration.checked,
    })) {
      status.textContent = 'Native, AI models and frame generation require Pro.';
      return;
    }
    save.disabled = true;
    status.textContent = 'Saving...';
    let settingsSaved = false;
    const update = {
      extensionEnabled: extensionEnabled.checked,
      mode: mode.value as EnhancementMode,
      quality: quality.value as QualityTier,
      output: 'auto' as const,
      backend: backend.value as RenderBackend,
      statsEnabled: statistics.checked,
      autoFullscreenEnabled: autoFullscreen.checked,
      frameGenerationEnabled: frameGeneration.checked,
    };
    try {
      await saveSettings(update);
      settingsSaved = true;
      await notifySettingsUpdated(update);
      status.textContent = 'Settings saved and applied.';
    } catch (error) {
      console.error('[AniWebScale] Could not save popup settings:', error);
      status.textContent = settingsSaved ? 'Settings saved, but could not be applied.' : 'Could not save settings.';
    } finally {
      save.disabled = false;
    }
  });

  openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
});
