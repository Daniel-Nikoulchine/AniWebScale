import '../common-vars.css';
import '../form-controls.css';
import './options.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import { applySettings } from '../../utils/apply-settings';
import { getSettings, DEFAULT_SETTINGS } from '../../utils/settings';
import { themeManager, type ThemeMode } from '../theme-manager';
import { renderEnhancementSelects, renderEnhancementToggles, renderToggle } from '../enhancement-controls';
import { refreshModeUi } from '../mode-ui';
import { createSettingsController, syncRenderSettings, type SettingsController } from '../settings-controller';
import { containsRenderSettingChange } from '../../utils/settings-change';

import { localizeDocument, message, initI18n, setUiLanguage, getUiLanguage, type UiLanguage } from '../i18n';
import { createPermissionController } from './permissions';
import { renderSystemStatus, runWebGpuTestRender, copyText, setBadge, type CapabilityStatus } from './diagnostics';
import { buildDiagnosticsText } from './diagnostics-info';

// ── Status feedback ───────────────────────────────────────────────────────

let statusTimer: ReturnType<typeof setTimeout> | undefined;

function showStatus(text: string): void {
  const status = document.getElementById('status') as HTMLDivElement;
  status.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────

async function initOptions(): Promise<void> {
  await initI18n();
  localizeDocument();
  const controls = renderEnhancementSelects(
    document.getElementById('enhancement-controls') as HTMLDivElement,
  );
  const { mode, quality, backend, realesrganCap } = controls;
  const toggles = renderEnhancementToggles(
    document.getElementById('enhancement-toggles') as HTMLDivElement,
    { includeStatistics: true },
  );
  const frameGeneration = toggles.frameGeneration;
  const statistics = toggles.statistics as HTMLInputElement;
  renderToggle(document.getElementById('verbose-logging-toggle') as HTMLDivElement, {
    id: 'verbose-logging',
    titleKey: 'enableVerboseLogging',
    titleFallback: 'Enable verbose logging',
    descriptionKey: 'verboseLoggingHint',
    descriptionFallback: 'Logs stash, pipeline and renderer events to the DevTools console.',
  });
  const verboseLogging = document.getElementById('verbose-logging') as HTMLInputElement;
  const compatibilityHint = document.getElementById('compatibility-hint') as HTMLParagraphElement;
  const theme = document.getElementById('theme') as HTMLSelectElement;
  const uiLanguage = document.getElementById('language') as HTMLSelectElement;
  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
  const version = document.getElementById('version') as HTMLSpanElement;
  const resetSettings = document.getElementById('reset-settings') as HTMLButtonElement;
  const testRender = document.getElementById('test-render') as HTMLButtonElement;
  const copyDiagnostics = document.getElementById('copy-diagnostics') as HTMLButtonElement;
  let settingsController: SettingsController;
  let webgpuStatus: 'available' | 'unavailable' = 'unavailable';
  let nativeStatus: CapabilityStatus = 'windows-only';
  const permissionController = createPermissionController(showStatus);
  const { renderWebsitePermissions, renderNativePermissions } = permissionController;

  const storedTheme = await chrome.storage.local.get(['theme', 'verboseLogging']);
  const initialTheme: ThemeMode = ['light', 'dark', 'auto'].includes(storedTheme.theme)
    ? storedTheme.theme as ThemeMode
    : 'auto';
  themeManager.setTheme(initialTheme);
  verboseLogging.checked = storedTheme.verboseLogging === true;
  version.textContent = chrome.runtime.getManifest().version;
  const settings = await getSettings();
  mode.value = settings.mode;
  quality.value = settings.quality;
  backend.value = settings.backend;
  if (realesrganCap) realesrganCap.value = String(settings.realesrganCapHeight);
  statistics.checked = settings.statsEnabled;
  frameGeneration.checked = settings.frameGenerationEnabled;
  theme.value = initialTheme;
  uiLanguage.value = getUiLanguage();

  uiLanguage.addEventListener('change', () => {
    void setUiLanguage(uiLanguage.value as UiLanguage).then(() => {
      // The options surface composes most of its text at render time, so a
      // reload picks up the new catalog consistently across every part.
      window.location.reload();
    });
  });

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

  // ── Scrollspy in the section navigation ────────────────────────────────

  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('#settings-nav a'));
  const sectionIds = ['enhancement', 'permissions', 'appearance', 'diagnostics'];
  function updateNavActive(): void {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let activeId = sectionIds[0];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el && (atBottom || el.getBoundingClientRect().top <= 16)) activeId = id;
    }
    for (const link of navLinks) {
      const isActive = link.getAttribute('href') === `#${activeId}`;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', updateNavActive, { passive: true });
  updateNavActive();

  const updateModeUi = () => refreshModeUi({
    mode,
    quality,
    backend,
    realesrganCap,
    frameGeneration,
    compatibilityHint,
  });
  settingsController = createSettingsController({
    controls: { mode, quality, backend, realesrganCap, statistics, frameGeneration },
    additionalControls: [verboseLogging],
    getLocalSettings: () => ({ verboseLogging: verboseLogging.checked }),
    onChange: updateModeUi,
    showStatus,
    messages: {
      saving: message('saving', 'Saving...'),
      saved: message('settingsSaved', 'Settings saved.'),
      applied: message('settingsSaved', 'Settings saved.'),
      savedNotApplied: message('optionsSavedNotApplied', 'Settings saved, but could not be applied. Reload the video tab.'),
      failed: message('settingsSaveFailed', 'Could not save settings.'),
    },
  });

  compatibilityHint.dataset.message = message(
    'frameGenerationLoad',
    'Frame generation increases GPU memory use and processing load.',
  );
  updateModeUi();

  theme.addEventListener('change', () => {
    themeManager.setTheme(theme.value as ThemeMode);
    refreshThemeUi();
    showStatus(message('settingsSaved', 'Settings saved.'));
  });

  // ── Live sync with other surfaces (popup, other tabs) ──────────────────


  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // Refresh hints whenever any render key changes, not only when a bound
    // control moved: keys without a visible control (e.g. autoFullscreen)
    // still affect the UI state.
    const renderChanged = containsRenderSettingChange(changes as Record<string, unknown>);
    if (syncRenderSettings(changes, { mode, quality, backend, realesrganCap, statistics, frameGeneration }, { verboseLogging })) updateModeUi();
    else if (renderChanged) updateModeUi();
    if (typeof changes.theme?.newValue === 'string'
      && ['light', 'dark', 'auto'].includes(changes.theme.newValue)
      && theme.value !== changes.theme.newValue) {
      theme.value = changes.theme.newValue as ThemeMode;
      themeManager.setTheme(theme.value as ThemeMode);
      refreshThemeUi();
    }
    if ('anime4kNativeConsentByOrigin' in changes) {
      void renderNativePermissions();
    }
  });

  // Permission grants/revokes happen in the popup while this page may be open.
  chrome.permissions.onAdded.addListener((permissions) => {
    if (permissions.origins?.length) void renderWebsitePermissions();
  });
  chrome.permissions.onRemoved.addListener((permissions) => {
    if (permissions.origins?.length) void renderWebsitePermissions();
  });

  // ── Reset to defaults ──────────────────────────────────────────────────

  resetSettings.addEventListener('click', async () => {
    if (!window.confirm(message('resetConfirm', 'Reset all settings to defaults?'))) return;
    const update = {
      extensionEnabled: DEFAULT_SETTINGS.extensionEnabled,
      mode: DEFAULT_SETTINGS.mode as EnhancementMode,
      quality: DEFAULT_SETTINGS.quality as QualityTier,
      output: 'auto' as const,
      backend: DEFAULT_SETTINGS.backend as RenderBackend,
      statsEnabled: DEFAULT_SETTINGS.statsEnabled,
      autoFullscreenEnabled: DEFAULT_SETTINGS.autoFullscreenEnabled,
      frameGenerationEnabled: DEFAULT_SETTINGS.frameGenerationEnabled,
      realesrganCapHeight: DEFAULT_SETTINGS.realesrganCapHeight,
    };
    const result = await applySettings(update, { local: { verboseLogging: false } })
      .catch(() => 'failed' as const);
    if (result === 'failed') {
      // Keep the controls in sync with storage instead of showing defaults
      // the save never persisted.
      const current = await getSettings().catch(() => null);
      if (current) {
        mode.value = current.mode;
        quality.value = current.quality;
        backend.value = current.backend;
        if (realesrganCap) realesrganCap.value = String(current.realesrganCapHeight);
        statistics.checked = current.statsEnabled;
        frameGeneration.checked = current.frameGenerationEnabled;
      }
      const stored = await chrome.storage.local.get(['verboseLogging']).catch(() => null);
      verboseLogging.checked = stored?.verboseLogging === true;
      const storedTheme = await chrome.storage.local.get(['theme']).catch(() => null);
      const currentTheme = storedTheme && ['light', 'dark', 'auto'].includes(storedTheme.theme)
        ? storedTheme.theme as ThemeMode
        : 'auto';
      theme.value = currentTheme;
      themeManager.setTheme(currentTheme);
      refreshThemeUi();
      uiLanguage.value = getUiLanguage();
      updateModeUi();
      showStatus(message('settingsSaveFailed', 'Could not save settings.'));
      return;
    }
    mode.value = DEFAULT_SETTINGS.mode;
    quality.value = DEFAULT_SETTINGS.quality;
    backend.value = DEFAULT_SETTINGS.backend;
    if (realesrganCap) realesrganCap.value = String(DEFAULT_SETTINGS.realesrganCapHeight);
    statistics.checked = DEFAULT_SETTINGS.statsEnabled;
    frameGeneration.checked = DEFAULT_SETTINGS.frameGenerationEnabled;
    verboseLogging.checked = false;
    // The confirmation promises a full reset: theme and language are
    // settings too, not just the render keys sent to applySettings.
    themeManager.setTheme('auto');
    theme.value = 'auto';
    refreshThemeUi();
    await setUiLanguage('auto').catch(() => undefined);
    uiLanguage.value = 'auto';
    updateModeUi();
    if (result === 'saved-not-applied') {
      showStatus(message('optionsSavedNotApplied', 'Settings saved, but could not be applied. Reload the video tab.'));
    } else showStatus(message('settingsReset', 'Settings reset to defaults.'));
  });

  // ── Test render + copy diagnostics ─────────────────────────────────────

  testRender.addEventListener('click', async () => {
    testRender.disabled = true;
    try {
      const badge = document.getElementById('webgpu-status') as HTMLSpanElement;
      setBadge(badge, message('statusChecking', 'Checking...'), null);
      const ok = await runWebGpuTestRender();
      webgpuStatus = ok ? 'available' : 'unavailable';
      setBadge(badge, ok ? message('statusAvailable', 'Available') : message('statusUnavailable', 'Unavailable'), ok);
      showStatus(ok
        ? message('testRenderPassed', 'Test render succeeded. WebGPU can render here.')
        : message('testRenderFailed', 'Test render failed. WebGPU cannot render on this browser.'));
    } finally {
      testRender.disabled = false;
    }
  });

  copyDiagnostics.addEventListener('click', async () => {
    const ok = await copyText(buildDiagnosticsText({
      version: version.textContent ?? chrome.runtime.getManifest().version,
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent,
      webgpu: webgpuStatus,
      native: nativeStatus,
      theme: theme.value,
    }));
    showStatus(ok
      ? message('diagnosticsCopied', 'Diagnostics copied to clipboard.')
      : message('diagnosticsCopyFailed', 'Could not copy diagnostics.'));
  });

  // ── Ctrl+S shortcut ────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void settingsController.saveNow();
    }
  });

  // ── Render permission lists + system status ────────────────────────────

  const capabilities = await Promise.all([
    renderWebsitePermissions(),
    renderNativePermissions(),
    renderSystemStatus(),
  ]);
  const systemStatus = capabilities[2];
  webgpuStatus = systemStatus.webgpu;
  nativeStatus = systemStatus.native;
}

document.addEventListener('DOMContentLoaded', () => {
  // An unguarded rejection here (extension context invalidated after an
  // update while the page is open) would kill the initializer silently and
  // leave a half-rendered, dead options page.
  initOptions().catch(error => {
    console.error('[Anime4K] options init failed:', error);
    showStatus(`Init failed: ${error instanceof Error ? error.message : String(error)}`);
  });
});
