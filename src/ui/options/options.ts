import './options.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  modeUsesQuality,
} from '../../shared/presets';
import { applySettings } from '../../utils/apply-settings';
import { getSettings, DEFAULT_SETTINGS } from '../../utils/settings';
import { themeManager, type ThemeMode } from '../theme-manager';
import { populateModeSelect, renderModeSummary } from '../mode-select';
import { localizeDocument, message } from '../i18n';
import { nativeResetConsentMessage, siteAccessSyncMessage } from '../../shared/runtime-messages';
import {
  getGrantedSitePatterns,
  revokeSiteAccessPatterns,
} from '../../site-access';
import { describeNativeConsents } from '../../shared/native-consent';
import { recordNativeConsent } from '../../shared/native-consent';
import { NATIVE_HOST_NAME } from '../../native/protocol';

// ── Undo state ────────────────────────────────────────────────────────────

type UndoState =
  | { type: 'website'; patterns: string[] }
  | { type: 'native'; entries: { origin: string; allowed: boolean }[] };

let undoState: UndoState | null = null;
let undoTimeout: ReturnType<typeof setTimeout> | undefined;

function showUndoToast(text: string, state: UndoState): void {
  clearUndoToast();
  undoState = state;
  const toast = document.getElementById('undo-toast') as HTMLDivElement;
  toast.textContent = '';
  toast.removeAttribute('hidden');
  const label = document.createElement('span');
  label.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = message('undo', 'Undo');
  btn.addEventListener('click', () => {
    const s = undoState;
    clearUndoToast();
    if (!s) return;
    if (s.type === 'website') {
      // permissions.request needs user gesture — this click IS the gesture.
      // First async call must be permissions.request, no awaits before it.
      void chrome.permissions.request({ origins: s.patterns }).then(async (granted) => {
        if (granted) {
          await chrome.runtime.sendMessage(siteAccessSyncMessage());
        }
        await renderWebsitePermissions();
      });
    } else {
      void (async () => {
        for (const entry of s.entries) {
          await recordNativeConsent(entry.origin, entry.allowed);
        }
        await renderNativePermissions();
      })();
    }
  });
  toast.append(label, btn);
  undoTimeout = setTimeout(clearUndoToast, 8000);
}

function clearUndoToast(): void {
  undoState = null;
  clearTimeout(undoTimeout);
  const toast = document.getElementById('undo-toast') as HTMLDivElement;
  toast.setAttribute('hidden', '');
}

// ── Auto-save ─────────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let statusTimer: ReturnType<typeof setTimeout> | undefined;

function showStatus(text: string): void {
  const status = document.getElementById('status') as HTMLDivElement;
  status.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 3000);
}

function collectSettingsUpdate() {
  return {
    mode: (document.getElementById('mode') as HTMLSelectElement).value as EnhancementMode,
    quality: (document.getElementById('quality') as HTMLSelectElement).value as QualityTier,
    output: 'auto' as const,
    backend: (document.getElementById('backend') as HTMLSelectElement).value as RenderBackend,
    statsEnabled: (document.getElementById('statistics') as HTMLInputElement).checked,
    frameGenerationEnabled: (document.getElementById('frame-generation') as HTMLInputElement).checked,
  };
}

async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  const status = document.getElementById('status') as HTMLDivElement;
  status.textContent = message('saving', 'Saving...');
  const update = collectSettingsUpdate();
  const verboseLogging = (document.getElementById('verbose-logging') as HTMLInputElement).checked;
  const result = await applySettings(update, { verboseLogging }).catch(() => 'failed' as const);
  if (result === 'failed') {
    console.error('[AniWebScale] Could not save options.');
    showStatus(message('settingsSaveFailed', 'Could not save settings.'));
  } else if (result === 'saved-not-applied') {
    showStatus(message('settingsSavedNotApplied', 'Settings saved, but could not be applied.'));
  } else {
    showStatus(message('settingsSaved', 'Settings saved.'));
  }
}

function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), 300);
}

// ── System status ─────────────────────────────────────────────────────────

function setBadge(el: HTMLElement, text: string, ok: boolean | null): void {
  el.textContent = text;
  el.className = 'status-badge';
  if (ok === true) el.classList.add('available');
  else if (ok === false) el.classList.add('unavailable');
  else el.classList.add('checking');
}

function probeNativeHost(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      port.onDisconnect.addListener(() => {
        resolve(!chrome.runtime.lastError);
      });
      setTimeout(() => {
        try { port.disconnect(); } catch { /* already disconnected */ }
        resolve(true);
      }, 300);
    } catch {
      resolve(false);
    }
  });
}

async function renderSystemStatus(): Promise<void> {
  const webgpuEl = document.getElementById('webgpu-status') as HTMLSpanElement;
  const nativeEl = document.getElementById('native-host-status') as HTMLSpanElement;

  // WebGPU
  let webgpuOk = false;
  if (navigator.gpu) {
    try {
      webgpuOk = Boolean(await navigator.gpu.requestAdapter());
    } catch {
      // WebGPU exists but no adapter; stays unavailable.
    }
  }
  setBadge(webgpuEl, webgpuOk ? message('statusAvailable', 'Available') : message('statusUnavailable', 'Unavailable'), webgpuOk);

  // Native host
  const isWindows = /win/i.test(navigator.platform) || navigator.userAgent.includes('Windows');
  if (!isWindows) {
    setBadge(nativeEl, message('statusWindowsOnly', 'Windows only'), null);
    return;
  }
  const installed = await probeNativeHost();
  setBadge(nativeEl, installed ? message('statusAvailable', 'Available') : message('statusUnavailable', 'Unavailable'), installed);
}

// ── Permission lists ──────────────────────────────────────────────────────

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
      await revokeSiteAccessPatterns([pattern]);
      await renderWebsitePermissions();
      showUndoToast(message('removedSite', 'Removed {site}', { site: pattern }), { type: 'website', patterns: [pattern] });
    });
    row.append(text, state, remove);
    list.appendChild(row);
  });

  clear.onclick = async () => {
    const all = [...granted];
    await revokeSiteAccessPatterns(granted);
    await renderWebsitePermissions();
    if (all.length > 0) {
      showUndoToast(message('clearedAllSites', 'All website access removed'), { type: 'website', patterns: all });
    }
  };
}

async function renderNativePermissions(): Promise<void> {
  const list = document.getElementById('native-sites') as HTMLDivElement;
  const clear = document.getElementById('clear-native-sites') as HTMLButtonElement;
  const entries = await describeNativeConsents();
  list.textContent = '';
  clear.disabled = entries.length === 0;

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = message('noNativeSites', 'No sites have permission to start the native renderer.');
    list.appendChild(empty);
  } else {
    entries.forEach(({ origin, allowed }) => {
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
        await chrome.runtime.sendMessage(nativeResetConsentMessage(origin));
        await renderNativePermissions();
        showUndoToast(message('removedSite', 'Removed {site}', { site: origin }), { type: 'native', entries: [{ origin, allowed }] });
      });
      row.append(text, state, remove);
      list.appendChild(row);
    });
  }

  clear.onclick = async () => {
    const all = entries.map(e => ({ origin: e.origin, allowed: e.allowed }));
    await chrome.runtime.sendMessage(nativeResetConsentMessage());
    await renderNativePermissions();
    if (all.length > 0) {
      showUndoToast(message('clearedAllNative', 'All native permissions removed'), { type: 'native', entries: all });
    }
  };
}

// ── Init ──────────────────────────────────────────────────────────────────

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
  const version = document.getElementById('version') as HTMLSpanElement;
  const verboseLogging = document.getElementById('verbose-logging') as HTMLInputElement;
  const resetSettings = document.getElementById('reset-settings') as HTMLButtonElement;

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
    showStatus(message('settingsSaved', 'Settings saved.'));
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
  mode.addEventListener('change', () => { refreshModeUi(); scheduleSave(); });
  frameGeneration.addEventListener('change', () => { refreshModeUi(); scheduleSave(); });
  backend.addEventListener('change', () => scheduleSave());
  quality.addEventListener('change', () => scheduleSave());
  statistics.addEventListener('change', () => scheduleSave());
  verboseLogging.addEventListener('change', () => scheduleSave());
  refreshModeUi();

  theme.addEventListener('change', () => {
    themeManager.setTheme(theme.value as ThemeMode);
    refreshThemeUi();
    showStatus(message('settingsSaved', 'Settings saved.'));
  });

  // ── Reset to defaults ──────────────────────────────────────────────────

  resetSettings.addEventListener('click', async () => {
    if (!window.confirm(message('resetConfirm', 'Reset all settings to defaults?'))) return;
    const update = {
      mode: DEFAULT_SETTINGS.mode as EnhancementMode,
      quality: DEFAULT_SETTINGS.quality as QualityTier,
      output: 'auto' as const,
      backend: DEFAULT_SETTINGS.backend as RenderBackend,
      statsEnabled: DEFAULT_SETTINGS.statsEnabled,
      frameGenerationEnabled: DEFAULT_SETTINGS.frameGenerationEnabled,
    };
    await applySettings(update, { verboseLogging: false });
    populateModeSelect(mode, DEFAULT_SETTINGS.mode);
    quality.value = DEFAULT_SETTINGS.quality;
    backend.value = DEFAULT_SETTINGS.backend;
    statistics.checked = DEFAULT_SETTINGS.statsEnabled;
    frameGeneration.checked = DEFAULT_SETTINGS.frameGenerationEnabled;
    verboseLogging.checked = false;
    refreshModeUi();
    showStatus(message('settingsReset', 'Settings reset to defaults.'));
  });

  // ── Ctrl+S shortcut ────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveNow();
    }
  });

  // ── Render permission lists + system status ────────────────────────────

  await Promise.all([
    renderWebsitePermissions(),
    renderNativePermissions(),
    renderSystemStatus(),
  ]);
});