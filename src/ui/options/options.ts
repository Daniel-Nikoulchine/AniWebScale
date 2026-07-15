import './options.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import {
  isProcessingEnabled,
  isOnnxUpscaleMode,
  modeUsesQuality,
  supportsOnnxWebGpuRuntime,
} from '../../shared/presets';
import { getSettings, saveSettings } from '../../utils/settings';
import { themeManager, type ThemeMode } from '../theme-manager';
import { populateModeSelect, renderModeSummary } from '../mode-select';
import type { AccountStatus } from '../../account/entitlement';
import { isProMode, requiresProConfiguration } from '../../account/entitlement';

const CONSENT_KEY = 'anime4kNativeConsentByOrigin';

document.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.lang = 'en';
  const mode = document.getElementById('mode') as HTMLSelectElement;
  const quality = document.getElementById('quality') as HTMLSelectElement;
  const backend = document.getElementById('backend') as HTMLSelectElement;
  const statistics = document.getElementById('statistics') as HTMLInputElement;
  const autoFullscreen = document.getElementById('auto-fullscreen') as HTMLInputElement;
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
  const accountPlan = document.getElementById('account-plan') as HTMLElement;
  const accountDetails = document.getElementById('account-details') as HTMLElement;
  const accountEmail = document.getElementById('account-email') as HTMLElement;
  const accountAuth = document.getElementById('account-auth') as HTMLElement;
  const accountSession = document.getElementById('account-session') as HTMLElement;
  const accountEmailInput = document.getElementById('account-email-input') as HTMLInputElement;
  const accountPassword = document.getElementById('account-password') as HTMLInputElement;
  const accountSignIn = document.getElementById('account-sign-in') as HTMLButtonElement;
  const accountSignUp = document.getElementById('account-sign-up') as HTMLButtonElement;
  const accountSignOut = document.getElementById('account-sign-out') as HTMLButtonElement;
  const accountRefresh = document.getElementById('account-refresh') as HTMLButtonElement;
  const accountUpgrade = document.getElementById('account-upgrade') as HTMLButtonElement;
  const accountStatus = document.getElementById('account-status') as HTMLElement;
  let hasPro = false;

  const storedTheme = await chrome.storage.sync.get(['theme']);
  const initialTheme: ThemeMode = ['light', 'dark', 'auto'].includes(storedTheme.theme)
    ? storedTheme.theme as ThemeMode
    : 'auto';
  themeManager.setTheme(initialTheme);
  version.textContent = chrome.runtime.getManifest().version;
  const settings = await getSettings();
  populateModeSelect(mode, settings.mode);
  quality.value = settings.quality;
  backend.value = settings.backend;
  statistics.checked = settings.statsEnabled;
  autoFullscreen.checked = settings.autoFullscreenEnabled;
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
      ? 'Switch to light theme'
      : 'Switch to dark theme');
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
    const onnxSupported = supportsOnnxWebGpuRuntime();
    const onnxWebGpuUnavailable = isOnnxUpscaleMode(selectedMode)
      && backend.value === 'webgpu'
      && !onnxSupported;
    const onnxUsesNative = isOnnxUpscaleMode(selectedMode)
      && backend.value === 'auto'
      && !onnxSupported;
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
    renderModeSummary(selectedMode, modeDescription, modeProfile);
    quality.disabled = !modeUsesQuality(selectedMode);
    backend.disabled = processingDisabled;
    const intensive = isOnnxUpscaleMode(selectedMode) || frameGeneration.checked;
    compatibilityHint.hidden = hasPro
      ? processingDisabled || (!onnxWebGpuUnavailable && !onnxUsesNative && !intensive)
      : false;
    compatibilityHint.textContent = !hasPro
      ? 'Free includes Anime4K and WebGPU. Sign in with Pro to unlock Native, AI models and frame generation.'
      : onnxWebGpuUnavailable
      ? 'ONNX AI upscaling cannot use WebGPU in Firefox. Select Auto or Native.'
      : onnxUsesNative
      ? 'Firefox will use the Native backend for this AI model when Backend is Auto.'
      : intensive
      ? 'Every processing mode can use WebGPU or Native. Combining 4x upscaling with frame generation may exceed GPU memory.'
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
      const response = await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: update }) as
        { ok?: boolean; message?: string } | undefined;
      if (response?.ok === false) throw new Error(response.message || 'The active renderer rejected the settings.');
      status.textContent = 'Settings saved.';
    } catch (error) {
      console.error('[AniWebScale] Could not save options:', error);
      status.textContent = settingsSaved ? 'Settings saved, but could not be applied.' : 'Could not save settings.';
    } finally {
      save.disabled = false;
    }
  });

  const renderAccount = (account: AccountStatus) => {
    hasPro = (account.plan === 'pro' || account.plan === 'lifetime')
      && (account.status === 'active' || account.status === 'trialing');
    accountPlan.textContent = account.plan === 'lifetime' ? 'Lifetime Pro' : hasPro ? 'Pro' : 'Free';
    accountDetails.textContent = hasPro ? 'Native + AI + Frame generation' : 'Anime4K + WebGPU';
    accountEmail.textContent = account.email || '';
    accountAuth.hidden = account.signedIn;
    accountSession.hidden = !account.signedIn;
    accountStatus.textContent = account.message
      || (account.signedIn ? 'License verified.' : 'Sign in to use a paid license.');
    refreshModeUi();
  };

  const accountRequest = async (type: string, extra: Record<string, unknown> = {}) => {
    accountStatus.textContent = 'Please wait…';
    const response = await chrome.runtime.sendMessage({ type, ...extra }) as
      { ok?: boolean; account?: AccountStatus; message?: string };
    if (!response?.ok || !response.account) {
      throw new Error(response?.message || 'Account request failed.');
    }
    renderAccount(response.account);
  };

  const authenticate = async (type: 'ACCOUNT_SIGN_IN' | 'ACCOUNT_SIGN_UP') => {
    const email = accountEmailInput.value.trim();
    const password = accountPassword.value;
    if (!email || password.length < 8) {
      accountStatus.textContent = 'Enter an email and a password with at least 8 characters.';
      return;
    }
    try {
      await accountRequest(type, { email, password });
      accountPassword.value = '';
    } catch (error) {
      accountStatus.textContent = error instanceof Error ? error.message : 'Authentication failed.';
    }
  };

  accountSignIn.addEventListener('click', () => void authenticate('ACCOUNT_SIGN_IN'));
  accountSignUp.addEventListener('click', () => void authenticate('ACCOUNT_SIGN_UP'));
  accountSignOut.addEventListener('click', () => void accountRequest('ACCOUNT_SIGN_OUT').catch(error => {
    accountStatus.textContent = error instanceof Error ? error.message : 'Sign out failed.';
  }));
  accountRefresh.addEventListener('click', () => void accountRequest('ACCOUNT_REFRESH').catch(error => {
    accountStatus.textContent = error instanceof Error ? error.message : 'License refresh failed.';
  }));
  accountUpgrade.addEventListener('click', () => void chrome.runtime.sendMessage({ type: 'OPEN_ACCOUNT_PAGE' }));

  await Promise.all([
    renderNativePermissions(),
    accountRequest('ACCOUNT_STATUS').catch(error => {
      accountStatus.textContent = error instanceof Error ? error.message : 'Account status unavailable.';
      renderAccount({
        signedIn: false,
        email: null,
        plan: 'free',
        status: 'inactive',
        features: ['anime4k', 'webgpu'],
      });
    }),
  ]);
});

async function getConsent(): Promise<Record<string, boolean>> {
  const data = await chrome.storage.local.get([CONSENT_KEY]);
  const value = data[CONSENT_KEY];
  return value && typeof value === 'object' ? value as Record<string, boolean> : {};
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
    empty.textContent = 'No sites have permission to start the native renderer.';
    list.appendChild(empty);
  } else {
    entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([origin, allowed]) => {
      const row = document.createElement('div');
      row.className = 'site-row';
      const text = document.createElement('code');
      text.textContent = origin;
      const state = document.createElement('span');
      state.className = allowed ? 'permission allowed' : 'permission blocked';
      state.textContent = allowed ? 'Allowed' : 'Blocked';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
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
