import type { EnhancementMode } from '../types';
import { isProcessingEnabled, modeUsesQuality } from '../shared/presets';
import { renderModeDescription } from './mode-select';

export interface ModeUiElements {
  mode: HTMLSelectElement;
  quality: HTMLSelectElement;
  backend: HTMLSelectElement;
  realesrganCap?: HTMLSelectElement;
  frameGeneration: HTMLInputElement;
  description?: HTMLElement;
  nativeWarning?: HTMLElement;
  compatibilityHint?: HTMLElement;
}

export function refreshModeUi(elements: ModeUiElements): void {
  const selectedMode = elements.mode.value as EnhancementMode;
  const processingDisabled = !isProcessingEnabled(
    selectedMode,
    elements.frameGeneration.checked,
  );

  elements.quality.disabled = !modeUsesQuality(selectedMode);
  elements.backend.disabled = processingDisabled;
  // Der Cap-Schalter gehört nur zum REALESRGAN-Modus; anderswo wäre er
  // irreführend, also wird das ganze Label versteckt, nicht nur disabled.
  const capLabel = elements.realesrganCap?.closest('label');
  if (elements.realesrganCap && capLabel instanceof HTMLElement) {
    const show = selectedMode === 'REALESRGAN';
    capLabel.style.display = show ? '' : 'none';
    elements.realesrganCap.disabled = !show;
  }

  if (elements.description) {
    renderModeDescription(selectedMode, elements.description);
  }
  if (elements.nativeWarning) {
    elements.nativeWarning.style.display = !processingDisabled
      && elements.backend.value === 'native'
      ? ''
      : 'none';
  }
  if (elements.compatibilityHint) {
    const intensive = elements.frameGeneration.checked;
    elements.compatibilityHint.hidden = !intensive;
    elements.compatibilityHint.textContent = intensive
      ? elements.compatibilityHint.dataset.message || ''
      : '';
  }
}
