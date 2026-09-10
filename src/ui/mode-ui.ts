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
  // Quality ist bei festen Netzen (Real-ESRGAN, ArtCNN, ACNet, ARNet) ein
  // No-Op: dort ganz versteckt statt nur disabled, damit niemand "Medium"
  // liest als würde es etwas bewirken. Das Grid schließt die Lücke von
  // selbst, der Cap-Schalter rutscht neben Backend.
  const qualityLabel = elements.quality.closest('label');
  if (qualityLabel instanceof HTMLElement) {
    qualityLabel.style.display = modeUsesQuality(selectedMode) ? '' : 'none';
  }
  elements.backend.disabled = processingDisabled;
  // Der Cap-Schalter gehört nur zum REALESRGAN-Modus; anderswo wäre er
  // irreführend, also wird das ganze Label versteckt, nicht nur disabled.
  const capLabel = elements.realesrganCap?.closest('label');
  const backendLabel = elements.backend.closest('label');
  if (elements.realesrganCap && capLabel instanceof HTMLElement) {
    const show = selectedMode === 'REALESRGAN';
    capLabel.style.display = show ? '' : 'none';
    elements.realesrganCap.disabled = !show;
    // Im REALESRGAN-Modus steht der Cap-Schalter links (Quality-Slot) und
    // Backend rechts wie gewohnt; anderswo gilt wieder die DOM-Reihenfolge.
    // Mode (order 0, volle Breite) bleibt immer oben.
    if (backendLabel instanceof HTMLElement) {
      capLabel.style.order = show ? '1' : '';
      backendLabel.style.order = show ? '2' : '';
    }
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
