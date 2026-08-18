import './popup.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  modeUsesQuality,
} from '../../shared/presets';
import { applySettings } from '../../utils/apply-settings';
import { getSettings } from '../../utils/settings';
import {
  describeSiteAccess,
  getPlayerFrameOrigins,
  grantSiteAccess,
  revokeSiteAccess,
} from '../../site-access';
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

  // Site access is approved per origin: the popup offers the active tab's
  // site only, never a blanket grant. The one exception is a broad grant
  // carried over from the blanket-permissions era, which the user must be
  // able to see and revoke as a whole. All grant/revoke sequencing lives in
  // the site-access service; this file only renders and invokes it.
  //
  // playerPatterns are collected here (before the click) so that
  // grantSiteAccess can call permissions.request synchronously inside the
  // click handler. Firefox rejects permissions.request if any await runs
  // between the user gesture and the call.
  let activeSite: { tabId: number; url: string; access: 'own' | 'broad' | 'none'; playerPatterns: string[] } | null = null;

  const refreshSiteAccess = async (): Promise<void> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const status = await describeSiteAccess(tab?.url);
    if (tab?.id === undefined || !tab.url || !status) {
      activeSite = null;
      siteAccessCard.dataset.state = 'unavailable';
      siteAccessSummary.textContent = message('siteAccessUnavailable', 'Site access is unavailable on this page.');
      siteAccessButton.style.display = '';
      siteAccessButton.disabled = true;
      siteAccessButton.textContent = message('siteAccessUnavailableAction', 'Unavailable');
      return;
    }

    // Pre-collect cross-origin player frame patterns so the grant click can
    // call permissions.request without an intervening await.
    const playerPatterns = status.access === 'none'
      ? await getPlayerFrameOrigins(tab.id)
      : [];

    activeSite = { tabId: tab.id, url: tab.url, access: status.access, playerPatterns };
    siteAccessCard.dataset.state = status.access === 'none' ? 'missing' : 'granted';
    siteAccessSummary.textContent = status.access === 'own'
      ? message('siteAccessGranted', 'AniWebScale can enhance videos on {site}.', { site: new URL(tab.url).host })
      : status.access === 'broad'
        ? message('siteAccessViaAllowAll', 'AniWebScale is allowed on every site through an allow-all grant.')
        : message('siteAccessMissing', 'Allow access only for {site} to enhance its videos.', { site: new URL(tab.url).host });
    siteAccessButton.style.display = '';
    siteAccessButton.textContent = status.access === 'own'
      ? message('removeSiteAccess', 'Remove access')
      : status.access === 'broad'
        ? message('removeAllowAllSiteAccess', 'Remove allow-all access')
        : message('allowSiteAccess', 'Allow this site');
    siteAccessButton.disabled = false;
  };

  siteAccessButton.addEventListener('click', async () => {
    if (!activeSite) return;
    const selected = activeSite;
    siteAccessButton.disabled = true;
    status.textContent = selected.access === 'none'
      ? message('requestingSiteAccess', 'Requesting site access...')
      : message('removingSiteAccess', 'Removing site access...');
    try {
      if (selected.access === 'none') {
        const outcome = await grantSiteAccess(
          { id: selected.tabId, url: selected.url },
          selected.playerPatterns,
        );
        status.textContent = outcome === 'injected'
          ? message('siteAccessReady', 'Site access granted. AniWebScale is ready here.')
          : outcome === 'reload-required'
            ? message('siteAccessGrantedReload', 'Site access granted. Reload the page to activate AniWebScale.')
            : message('siteAccessNotGranted', 'Site access was not granted.');
      } else {
        const changed = await revokeSiteAccess(selected.url);
        status.textContent = changed
          ? message('siteAccessRemoved', 'Site access removed. Reload the page to finish cleanup.')
          : message('siteAccessRemoveFailed', 'Site access was not removed.');
      }
    } catch (error) {
      console.error('[AniWebScale] Could not change site access:', error);
      status.textContent = error instanceof Error
        ? error.message
        : message('siteAccessChangeFailed', 'Could not change site access.');
    } finally {
      await refreshSiteAccess().catch(error => {
        console.warn('[AniWebScale] Could not refresh site access state:', error);
        siteAccessButton.disabled = false;
      });
    }
  });

  await refreshSiteAccess().catch(error => {
    console.warn('[AniWebScale] Could not inspect site access:', error);
    siteAccessCard.dataset.state = 'unavailable';
    siteAccessSummary.textContent = message('siteAccessCheckFailed', 'Site access could not be checked.');
    siteAccessButton.disabled = true;
  });

  version.textContent = chrome.runtime.getManifest().version;
  const settings = await getSettings();
  extensionEnabled.checked = settings.extensionEnabled;
  populateModeSelect(mode, settings.mode);
  quality.value = settings.quality;
  backend.value = settings.backend;
  statistics.checked = settings.statsEnabled;
  frameGeneration.checked = settings.frameGenerationEnabled;

  extensionEnabled.addEventListener('change', async () => {
    const enabled = extensionEnabled.checked;
    extensionEnabled.disabled = true;
    status.textContent = enabled
      ? message('enablingExtension', 'Enabling extension...')
      : message('disablingExtension', 'Disabling extension...');
    const result = await applySettings({ extensionEnabled: enabled }).catch(() => 'failed' as const);
    extensionEnabled.disabled = false;
    if (result === 'failed') {
      extensionEnabled.checked = !enabled;
      status.textContent = message('extensionStatusChangeFailed', 'Could not change extension status.');
      return;
    }
    if (result === 'saved-not-applied') {
      status.textContent = message('extensionStatusSavedNotApplied', 'Extension status saved, but could not be applied.');
      return;
    }
    status.textContent = enabled
      ? message('extensionEnabledStatus', 'Extension enabled.')
      : message('extensionDisabledStatus', 'Extension disabled.');
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
    const result = await applySettings(update).catch(() => 'failed' as const);
    if (result === 'failed') {
      console.error('[AniWebScale] Could not save popup settings.');
      status.textContent = message('settingsSaveFailed', 'Could not save settings.');
    } else if (result === 'saved-not-applied') {
      status.textContent = message('settingsSavedNotApplied', 'Settings saved, but could not be applied.');
    } else {
      status.textContent = message('settingsSavedApplied', 'Settings saved and applied.');
    }
    save.disabled = false;
  });

  openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
});
