import './onboarding.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import { modeUsesQuality } from '../../shared/presets';
import { DEFAULT_SETTINGS, saveLocalSettings, saveSettings } from '../../utils/settings';
import { themeManager } from '../theme-manager';
import { populateModeSelect, renderModeSummary } from '../mode-select';
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

  populateModeSelect(mode, DEFAULT_SETTINGS.mode);

  const updateModeUi = () => {
    const selectedMode = mode.value as EnhancementMode;
    renderModeSummary(selectedMode, modeDescription, modeProfile);
    quality.disabled = !modeUsesQuality(selectedMode);
    status.textContent = '';
  };
  mode.addEventListener('change', updateModeUi);
  backend.addEventListener('change', updateModeUi);
  frameGeneration.addEventListener('change', updateModeUi);
  updateModeUi();

  finish.addEventListener('click', async () => {
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

  updateModeUi();
});
