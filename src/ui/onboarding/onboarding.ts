import './onboarding.css';
import '../common-vars.css';
import type { EnhancementMode, QualityTier, RenderBackend } from '../../types';
import { modeUsesQuality, supportsWebGpuConfiguration } from '../../shared/presets';
import { DEFAULT_SETTINGS, saveLocalSettings, saveSettings } from '../../utils/settings';
import { themeManager } from '../theme-manager';
import { populateModeSelect, renderModeSummary } from '../mode-select';

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = 'en';
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

  const updateCompatibility = () => {
    const selectedMode = mode.value as EnhancementMode;
    const unsupported = backend.value === 'webgpu'
      && !supportsWebGpuConfiguration(selectedMode);
    renderModeSummary(selectedMode, modeDescription, modeProfile);
    quality.disabled = !modeUsesQuality(selectedMode);
    finish.disabled = unsupported;
    status.textContent = unsupported
      ? 'ONNX AI upscaling cannot use WebGPU in Firefox. Select Auto or Native.'
      : '';
  };
  mode.addEventListener('change', updateCompatibility);
  backend.addEventListener('change', updateCompatibility);
  updateCompatibility();

  finish.addEventListener('click', async () => {
    if (backend.value === 'webgpu' && !supportsWebGpuConfiguration(mode.value as EnhancementMode)) {
      updateCompatibility();
      return;
    }
    finish.disabled = true;
    status.textContent = 'Saving setup...';
    try {
      const update = {
        mode: mode.value as EnhancementMode,
        quality: quality.value as QualityTier,
        output: 'auto' as const,
        backend: backend.value as RenderBackend,
        statsEnabled: true,
        frameGenerationEnabled: frameGeneration.checked,
      };
      await Promise.all([
        saveSettings(update),
        saveLocalSettings({ hasCompletedOnboarding: true }),
      ]);
      await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: update });
      status.textContent = 'Setup complete. You can close this tab.';
      finish.textContent = 'Done';
    } catch (error) {
      console.error('[AniWebScale] Setup failed:', error);
      status.textContent = 'Setup could not be saved.';
      finish.disabled = false;
    }
  });
});
