import './popup.css';
import '../common-vars.css';
import type { Anime4KWebExtSettings, EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  modeUsesQuality,
} from '../../shared/presets';
import { getSettings, saveSettings } from '../../utils/settings';
import { hasAllWebsiteAccess, requestAllWebsiteAccess } from '../../site-access';
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

  // Content scripts are declared in manifest.json for all sites. Chrome
  // grants those host permissions automatically, but Firefox treats MV3 host
  // permissions like optional ones and leaves them ungranted until the user
  // agrees — offer the runtime request instead of sending people to
  // about:addons.
  const updateSiteAccessUi = async () => {
    if (await hasAllWebsiteAccess()) {
      siteAccessCard.dataset.state = 'granted';
      siteAccessSummary.textContent = message('siteAccessGranted', 'AniWebScale is active on all websites.');
      siteAccessButton.style.display = 'none';
      return;
    }
    siteAccessCard.dataset.state = 'unavailable';
    siteAccessSummary.textContent = message(
      'siteAccessAllMissing',
      'AniWebScale has no website access in this browser yet.',
    );
    siteAccessButton.style.display = '';
    siteAccessButton.disabled = false;
    siteAccessButton.textContent = message('allowAllWebsites', 'Allow on all websites');
  };
  siteAccessButton.addEventListener('click', async () => {
    siteAccessButton.disabled = true;
    try {
      await requestAllWebsiteAccess();
    } catch (error) {
      console.error('[AniWebScale] Could not request website access:', error);
    } finally {
      await updateSiteAccessUi();
      siteAccessButton.disabled = false;
    }
  });
  await updateSiteAccessUi();

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
