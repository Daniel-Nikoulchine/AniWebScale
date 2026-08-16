import './options.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  modeUsesQuality,
} from '../../shared/presets';
import { getSettings, saveSettings, saveLocalSettings } from '../../utils/settings';
import { themeManager, type ThemeMode } from '../theme-manager';
import { populateModeSelect, renderModeSummary } from '../mode-select';
import { localizeDocument, message } from '../i18n';
import {
  getGrantedSitePatterns,
  removeSiteAccessPatterns,
} from '../../site-access';

const CONSENT_KEY = 'anime4kNativeConsentByOrigin';

document.addEventListener('DOMContentLoaded', async () => {
  localizeDocument();
  const mode = document.getElementById('mode') as HTMLSelectElement;
  const quality = document.getElementById('quality') as HTMLSelectElement;
  const backend = document.getElementById('backend') as HTMLSelectElement;
  const statistics = document.getElementById('statistics') as HTMLInputElement;
  const frameGeneration = document.getElementById('frame-generation') as HTMLInputElement;
  const modeDescription = document.getElementById('mode-description') as HTMLElement;
  const modeProfile = document.getElementById('mode-profile') as HTMLElement;
  const compatibilityHint = document.getElementById('compatibility-hint') as HTMLParagraphElement;
  const theme = document.getElementById('theme') as HTMLSelectElement;
  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
  const menuButton = document.querySelector('.menu-button') as HTMLButtonElement;
  const settingsNav = document.getElementById('settings-nav') as HTMLElement;
  const save = document.getElementById('save') as HTMLButtonElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const version = document.getElementById('version') as HTMLSpanElement;
  const verboseLogging = document.getElementById('verbose-logging') as HTMLInputElement;

  const storedTheme = await chrome.storage.local.get(['theme', 'verboseLogging']);
  const initialTheme: ThemeMode = ['light', 'dark', 'auto'].includes(storedTheme.theme)
    ? storedTheme.theme as ThemeMode
    : 'auto';
  themeManager.setTheme(initialTheme);
  verboseLogging.checked = storedTheme.verboseLogging === true;
  version.textContent = chrome.runtime.getManifest().version;
  const settings = await getSettings();
  populateModeSelect(mode, settings.mode);
  quality.value = settings.quality;
  backend.value = settings.backend;
  statistics.checked = settings.statsEnabled;
  frameGeneration.checked = settings.frameGenerationEnabled;
  theme.value = initialTheme;

  const refreshThemeUi = () => {
    const effectiveTheme = themeManager.getEffectiveTheme();
    document.documentElement.dataset.theme = effectiveTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      effectiveTheme === 'dark' ? '#20263a' : '#fffaf3',
    );
    themeToggle.setAttribute('aria-label', effectiveTheme === 'dark'
      ? message('switchLightTheme', 'Switch to light theme')
      : message('switchDarkTheme', 'Switch to dark theme'));
  };
  refreshThemeUi();
  themeToggle.addEventListener('click', () => {
    const nextTheme: ThemeMode = themeManager.getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    themeManager.setTheme(nextTheme);
    theme.value = nextTheme;
    refreshThemeUi();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshThemeUi);

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    settingsNav.classList.toggle('open', open);
  });
  settingsNav.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      settingsNav.classList.remove('open');
    }
  });

  const refreshModeUi = () => {
    const selectedMode = mode.value as EnhancementMode;
    const processingDisabled = !isProcessingEnabled(selectedMode, frameGeneration.checked);
    renderModeSummary(selectedMode, modeDescription, modeProfile);
    quality.disabled = !modeUsesQuality(selectedMode);
    backend.disabled = processingDisabled;
    const intensive = frameGeneration.checked;
    compatibilityHint.hidden = !intensive;
    compatibilityHint.textContent = intensive
      ? message('frameGenerationLoad', 'Frame generation increases GPU memory use and processing load.')
      : '';
  };
  mode.addEventListener('change', refreshModeUi);
  frameGeneration.addEventListener('change', refreshModeUi);
  backend.addEventListener('change', refreshModeUi);
  refreshModeUi();

  theme.addEventListener('change', () => {
    themeManager.setTheme(theme.value as ThemeMode);
    refreshThemeUi();
  });
  save.addEventListener('click', async () => {
    save.disabled = true;
    status.textContent = message('saving', 'Saving...');
    let settingsSaved = false;
    const update = {
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
      await saveLocalSettings({ verboseLogging: verboseLogging.checked });
      settingsSaved = true;
      const response = await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: update }) as
        { ok?: boolean; message?: string } | undefined;
      if (response?.ok === false) throw new Error(response.message || message('rendererRejectedSettings', 'The active renderer rejected the settings.'));
      status.textContent = message('settingsSaved', 'Settings saved.');
    } catch (error) {
      console.error('[AniWebScale] Could not save options:', error);
      status.textContent = settingsSaved
        ? message('settingsSavedNotApplied', 'Settings saved, but could not be applied.')
        : message('settingsSaveFailed', 'Could not save settings.');
    } finally {
      save.disabled = false;
    }
  });

  await Promise.all([
    renderWebsitePermissions(),
    renderNativePermissions(),
  ]);
});

async function getConsent(): Promise<Record<string, boolean>> {
  const data = await chrome.storage.local.get([CONSENT_KEY]);
  const value = data[CONSENT_KEY];
  return value && typeof value === 'object' ? value as Record<string, boolean> : {};
}

async function synchronizeSiteAccess(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'SITE_ACCESS_SYNC' }) as
    { ok?: boolean; message?: string } | undefined;
  if (response?.ok === false) {
    throw new Error(response.message || message('siteAccessSyncFailed', 'Site access could not be applied.'));
  }
}

// Every granted pattern is an optional per-site (or leftover broad) grant
// that can be revoked at runtime; nothing is manifest-mandatory anymore.
async function renderWebsitePermissions(): Promise<void> {
  const list = document.getElementById('website-sites') as HTMLDivElement;
  const clear = document.getElementById('clear-website-sites') as HTMLButtonElement;
  const granted = await getGrantedSitePatterns();
  list.textContent = '';
  clear.disabled = granted.length === 0;

  if (granted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = message('noWebsiteSites', 'No websites can run AniWebScale yet.');
    list.appendChild(empty);
  }
  granted.forEach(pattern => {
    const row = document.createElement('div');
    row.className = 'site-row';
    const text = document.createElement('code');
    text.textContent = pattern;
    const state = document.createElement('span');
    state.className = 'permission allowed';
    state.textContent = message('allowed', 'Allowed');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = message('remove', 'Remove');
    remove.addEventListener('click', async () => {
      await removeSiteAccessPatterns([pattern]);
      await synchronizeSiteAccess();
      await renderWebsitePermissions();
    });
    row.append(text, state, remove);
    list.appendChild(row);
  });

  clear.onclick = async () => {
    await removeSiteAccessPatterns(granted);
    await synchronizeSiteAccess();
    await renderWebsitePermissions();
  };
}

async function renderNativePermissions(): Promise<void> {
  const list = document.getElementById('native-sites') as HTMLDivElement;
  const clear = document.getElementById('clear-native-sites') as HTMLButtonElement;
  const consent = await getConsent();
  const entries = Object.entries(consent);
  list.textContent = '';
  clear.disabled = entries.length === 0;

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = message('noNativeSites', 'No sites have permission to start the native renderer.');
    list.appendChild(empty);
  } else {
    entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([origin, allowed]) => {
      const row = document.createElement('div');
      row.className = 'site-row';
      const text = document.createElement('code');
      text.textContent = origin;
      const state = document.createElement('span');
      state.className = allowed ? 'permission allowed' : 'permission blocked';
      state.textContent = allowed
        ? message('allowed', 'Allowed')
        : message('blocked', 'Blocked');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = message('remove', 'Remove');
      remove.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'NATIVE_RESET_CONSENT', origin });
        await renderNativePermissions();
      });
      row.append(text, state, remove);
      list.appendChild(row);
    });
  }

  clear.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'NATIVE_RESET_CONSENT' });
    await renderNativePermissions();
  };
}
