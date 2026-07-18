import './onboarding.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import { modeUsesQuality } from '../../shared/presets';
import { DEFAULT_SETTINGS, saveLocalSettings, saveSettings } from '../../utils/settings';
import { themeManager } from '../theme-manager';
import { populateModeSelect, renderModeSummary } from '../mode-select';
import type { AccountStatus } from '../../account/entitlement';
import { isProMode, requiresProConfiguration } from '../../account/entitlement';
import { renderPlanAccessLabels } from '../plan-access';
import { localizeDocument, message } from '../i18n';

document.addEventListener('DOMContentLoaded', async () => {
  localizeDocument();
  themeManager.getTheme();
  const finish = document.getElementById('finish') as HTMLButtonElement;
  const mode = document.getElementById('mode') as HTMLSelectElement;
  const quality = document.getElementById('quality') as HTMLSelectElement;
  const backend = document.getElementById('backend') as HTMLSelectElement;
  const frameGeneration = document.getElementById('frame-generation') as HTMLInputElement;
  const modeDescription = document.getElementById('mode-description') as HTMLElement;
  const modeProfile = document.getElementById('mode-profile') as HTMLElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const planHint = document.getElementById('plan-hint') as HTMLElement;
  const viewPlans = document.getElementById('view-plans') as HTMLButtonElement;
  const frameGenerationDescription = document.getElementById('frame-generation-description') as HTMLElement;
  let hasPro = false;

  populateModeSelect(mode, DEFAULT_SETTINGS.mode);

  const updateModeUi = () => {
    renderPlanAccessLabels(
      mode,
      backend,
      frameGeneration,
      frameGenerationDescription,
      hasPro,
      message('frameMotion2xEvenOff', 'Motion-aware 2x, even while enhancement is off.'),
    );
    mode.querySelectorAll('option').forEach(option => {
      if (isProMode(option.value as EnhancementMode)) option.disabled = !hasPro;
    });
    Array.from(backend.options).forEach(option => {
      if (option.value !== 'webgpu') option.disabled = !hasPro;
    });
    if (!hasPro && isProMode(mode.value as EnhancementMode)) mode.value = 'A';
    if (!hasPro && backend.value !== 'webgpu') backend.value = 'webgpu';
    frameGeneration.disabled = !hasPro;
    if (!hasPro) frameGeneration.checked = false;
    const selectedMode = mode.value as EnhancementMode;
    renderModeSummary(selectedMode, modeDescription, modeProfile);
    quality.disabled = !modeUsesQuality(selectedMode);
    status.textContent = '';
  };
  mode.addEventListener('change', updateModeUi);
  backend.addEventListener('change', updateModeUi);
  frameGeneration.addEventListener('change', updateModeUi);
  viewPlans.addEventListener('click', () => void chrome.runtime.sendMessage({ type: 'OPEN_ACCOUNT_PAGE' }));
  updateModeUi();

  finish.addEventListener('click', async () => {
    if (!hasPro && requiresProConfiguration({
      mode: mode.value as EnhancementMode,
      backend: backend.value as RenderBackend,
      frameGenerationEnabled: frameGeneration.checked,
    })) {
      status.textContent = message('onboardingProRequired', 'AI upscaling, Native and frame generation require Pro.');
      return;
    }
    finish.disabled = true;
    status.textContent = message('savingSetup', 'Saving setup...');
    try {
      const update = {
        mode: mode.value as EnhancementMode,
        quality: quality.value as QualityTier,
        output: 'auto' as const,
        backend: backend.value as RenderBackend,
        statsEnabled: DEFAULT_SETTINGS.statsEnabled,
        frameGenerationEnabled: frameGeneration.checked,
      };
      await Promise.all([
        saveSettings(update),
        saveLocalSettings({ hasCompletedOnboarding: true }),
      ]);
      await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: update });
      status.textContent = message('setupComplete', 'Setup complete. You can close this tab.');
      finish.textContent = message('done', 'Done');
    } catch (error) {
      console.error('[AniWebScale] Setup failed:', error);
      status.textContent = message('setupSaveFailed', 'Setup could not be saved.');
      finish.disabled = false;
    }
  });

  try {
    const response = await chrome.runtime.sendMessage({ type: 'ACCOUNT_STATUS', refresh: false }) as
      { ok?: boolean; account?: AccountStatus } | undefined;
    const account = response?.account;
    hasPro = Boolean(account
      && (account.plan === 'pro' || account.plan === 'lifetime')
      && (account.status === 'active' || account.status === 'trialing'));
  } catch (error) {
    console.warn('[AniWebScale] Account status unavailable during onboarding:', error);
  }

  planHint.dataset.plan = hasPro ? 'pro' : 'free';
  const planCopy = planHint.querySelector('span');
  if (planCopy) {
    const planName = document.createElement('strong');
    planName.textContent = hasPro
      ? message('proActive', 'Pro active')
      : message('freePlan', 'Free plan');
    planCopy.replaceChildren(
      planName,
      hasPro
        ? message('onboardingProUnlocked', ' All enhancement modes, renderers and frame generation are unlocked.')
        : message('onboardingFreeIncluded', ' Anime4K presets + WebGPU are included. AI upscaling, Native and Frame generation require Pro.'),
    );
  }
  viewPlans.textContent = hasPro
    ? message('managePlan', 'Manage plan')
    : message('viewProPlans', 'View Pro plans');
  updateModeUi();
});
