import '../common-vars.css';
import '../form-controls.css';
import './onboarding.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import { renderEnhancementSelects, refreshEnhancementControlLabels, renderEnhancementToggles } from '../enhancement-controls';
import { refreshModeUi } from '../mode-ui';
import { DEFAULT_SETTINGS } from '../../utils/settings';
import { themeManager } from '../theme-manager';
import { applySettings } from '../../utils/apply-settings';
import { localizeDocument, message, initI18n, setUiLanguage, getUiLanguage, type UiLanguage } from '../i18n';

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  localizeDocument();
  themeManager.getTheme();
  const finish = document.getElementById('finish') as HTMLButtonElement;
  const controls = renderEnhancementSelects(
    document.getElementById('enhancement-controls') as HTMLDivElement,
  );
  const { mode, quality, backend } = controls;
  const toggles = renderEnhancementToggles(
    document.getElementById('enhancement-toggles') as HTMLDivElement,
    { includeStatistics: false },
  );
  const frameGeneration = toggles.frameGeneration;
  const language = document.getElementById('language') as HTMLSelectElement;
  const theme = document.getElementById('theme') as HTMLSelectElement;
  const status = document.getElementById('status') as HTMLDivElement;

  language.value = getUiLanguage();
  language.addEventListener('change', () => {
    void setUiLanguage(language.value as UiLanguage).then(() => {
      localizeDocument();
      refreshEnhancementControlLabels(controls);
    });
  });

  const storedTheme = await chrome.storage.local.get(['theme']);
  const initialTheme = ['light', 'dark', 'auto'].includes(storedTheme.theme)
    ? storedTheme.theme as 'light' | 'dark' | 'auto'
    : 'auto';
  themeManager.setTheme(initialTheme);
  theme.value = initialTheme;
  theme.addEventListener('change', () => {
    themeManager.setTheme(theme.value as 'light' | 'dark' | 'auto');
  });

  const updateModeUi = () => {
    refreshModeUi({ mode, quality, backend, frameGeneration });
    status.textContent = '';
  };
  mode.addEventListener('change', updateModeUi);
  backend.addEventListener('change', updateModeUi);
  frameGeneration.addEventListener('change', updateModeUi);
  updateModeUi();

  finish.addEventListener('click', async () => {
    finish.disabled = true;
    status.textContent = message('savingSetup', 'Saving setup...');
    const update = {
      mode: mode.value as EnhancementMode,
      quality: quality.value as QualityTier,
      output: 'auto' as const,
      backend: backend.value as RenderBackend,
      statsEnabled: DEFAULT_SETTINGS.statsEnabled,
      frameGenerationEnabled: frameGeneration.checked,
    };
    // Onboarding has no active renderer to refuse the update, so every
    // persisted outcome counts as complete.
    const result = await applySettings(update, {
      local: {
        hasCompletedOnboarding: true,
        siteAccessModelAcknowledged: true,
      },
    }).catch(() => 'failed' as const);
    if (result === 'failed') {
      console.error('[AniWebScale] Setup failed.');
      status.textContent = message('setupSaveFailed', 'Setup could not be saved.');
      finish.disabled = false;
      return;
    }
    status.textContent = message('setupComplete', 'Setup complete. You can close this tab.');
    finish.textContent = message('done', 'Done');
  });

});
