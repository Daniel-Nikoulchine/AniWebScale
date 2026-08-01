import './popup.css';
import '../common-vars.css';
import type { Anime4KWebExtSettings, EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  modeUsesQuality,
} from '../../shared/presets';
import { getSettings, saveSettings } from '../../utils/settings';
import { populateModeSelect, renderModeDescription } from '../mode-select';
import { themeManager } from '../theme-manager';
import { localizeDocument, message } from '../i18n';

document.addEventListener('DOMContentLoaded', async () => {
  localizeDocument();
  themeManager.getTheme();

  const mode = document.getElementById('mode') as HTMLSelectElement;
  const modeDescription = document.getElementById('mode-description') as HTMLParagraphElement;
  const extensionEnabled = document.getElementById('extension-enabled') as HTMLInputElement;
  const quality = document.getElementById('quality') as HTMLSelectElement;
  const backend = document.getElementById('backend') as HTMLSelectElement;
  const statistics = document.getElementById('statistics') as HTMLInputElement;
  const frameGeneration = document.getElementById('frame-generation') as HTMLInputElement;
  const save = document.getElementById('save') as HTMLButtonElement;
  const openOptions = document.getElementById('open-options') as HTMLButtonElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const version = document.getElementById('version') as HTMLSpanElement;
  const siteAccessCard = document.getElementById('site-access-card') as HTMLElement;
  const siteAccessSummary = document.getElementById('site-access-summary') as HTMLElement;
  const siteAccessButton = document.getElementById('site-access') as HTMLButtonElement;

  // Content scripts are declared in manifest.json with host_permissions for
  // all sites. Per-site access grants are no longer needed.
  siteAccessCard.dataset.state = 'granted';
  siteAccessSummary.textContent = message('siteAccessGranted', 'AniWebScale is active on all websites.');
  siteAccessButton.style.display = 'none';

  version.textContent = chrome.runtime.getManifest().version;
  const settings = await getSettings();
  extensionEnabled.checked = settings.extensionEnabled;
  populateModeSelect(mode, settings.mode);
  quality.value = settings.quality;
  backend.value = settings.backend;
  statistics.checked = settings.statsEnabled;
  frameGeneration.checked = settings.frameGenerationEnabled;

  const notifySettingsUpdated = async (update: Partial<Anime4KWebExtSettings>): Promise<void> => {
    const response = await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: update }) as
      { ok?: boolean; message?: string } | undefined;
    if (response?.ok === false) throw new Error(response.message || message('rendererRejectedSettings', 'The active renderer rejected the settings.'));
  };

  extensionEnabled.addEventListener('change', async () => {
    const enabled = extensionEnabled.checked;
    extensionEnabled.disabled = true;
    status.textContent = enabled
      ? message('enablingExtension', 'Enabling extension...')
      : message('disablingExtension', 'Disabling extension...');
    let settingsSaved = false;
    try {
      const update = { extensionEnabled: enabled };
      await saveSettings(update);
      settingsSaved = true;
      await notifySettingsUpdated(update);
      status.textContent = enabled
        ? message('extensionEnabledStatus', 'Extension enabled.')
        : message('extensionDisabledStatus', 'Extension disabled.');
    } catch (error) {
      console.error('[AniWebScale] Could not change extension status:', error);
      if (!settingsSaved) extensionEnabled.checked = !enabled;
      status.textContent = settingsSaved
        ? message('extensionStatusSavedNotApplied', 'Extension status saved, but could not be applied.')
        : message('extensionStatusChangeFailed', 'Could not change extension status.');
    } finally {
      extensionEnabled.disabled = false;
    }
  });

  const refreshModeUi = () => {
    const selectedMode = mode.value as EnhancementMode;
    const processingDisabled = !isProcessingEnabled(selectedMode, frameGeneration.checked);
    renderModeDescription(selectedMode, modeDescription);
    quality.disabled = !modeUsesQuality(selectedMode);
    backend.disabled = processingDisabled;
  };
  mode.addEventListener('change', refreshModeUi);
  frameGeneration.addEventListener('change', refreshModeUi);
  backend.addEventListener('change', refreshModeUi);
  refreshModeUi();

  save.addEventListener('click', async () => {
    save.disabled = true;
    status.textContent = message('saving', 'Saving...');
    let settingsSaved = false;
    const update = {
      extensionEnabled: extensionEnabled.checked,
      mode: mode.value as EnhancementMode,
      quality: quality.value as QualityTier,
      output: 'auto' as const,
      backend: backend.value as RenderBackend,
      statsEnabled: statistics.checked,
      autoFullscreenEnabled: true,
      frameGenerationEnabled: frameGeneration.checked,
    };
    try {
      await saveSettings(update);
      settingsSaved = true;
      await notifySettingsUpdated(update);
      status.textContent = message('settingsSavedApplied', 'Settings saved and applied.');
    } catch (error) {
      console.error('[AniWebScale] Could not save popup settings:', error);
      status.textContent = settingsSaved
        ? message('settingsSavedNotApplied', 'Settings saved, but could not be applied.')
        : message('settingsSaveFailed', 'Could not save settings.');
    } finally {
      save.disabled = false;
    }
  });

  openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
});
