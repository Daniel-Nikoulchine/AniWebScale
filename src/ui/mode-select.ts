import type { EnhancementMode } from '../types';
import {
  AI_UPSCALE_MODES,
  ANIME4K_MODES,
  isEnhancementMode,
} from '../shared/presets';
import { message } from './i18n';

interface ModePresentation {
  optionKey: string;
  optionLabel: string;
  descriptionKey: string;
  description: string;
}

export const MODE_PRESENTATIONS: Record<EnhancementMode, ModePresentation> = {
  OFF: { optionKey: 'modeOffOption', optionLabel: 'Off', descriptionKey: 'modeOffDescription', description: 'Disables image enhancement. Frame generation can still be enabled separately.' },
  A: { optionKey: 'modeAOption', optionLabel: 'Anime4K A · Balanced', descriptionKey: 'modeADescription', description: 'Restores line detail, then applies Anime4K CNN 2x upscaling. The balanced default for most anime.' },
  B: { optionKey: 'modeBOption', optionLabel: 'Anime4K B · Soft restore', descriptionKey: 'modeBDescription', description: 'Softer restoration before Anime4K CNN 2x upscaling reduces ringing on blurry or compressed video.' },
  C: { optionKey: 'modeCOption', optionLabel: 'Anime4K C · Denoise', descriptionKey: 'modeCDescription', description: 'Denoises and upscales 2x in one Anime4K CNN pass. Best suited to visibly noisy animation.' },
  AA: { optionKey: 'modeAaOption', optionLabel: 'Anime4K A+A · Strong', descriptionKey: 'modeAaDescription', description: 'Runs the Anime4K A restoration chain twice for stronger detail and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.' },
  BB: { optionKey: 'modeBbOption', optionLabel: 'Anime4K B+B · Strong soft', descriptionKey: 'modeBbDescription', description: 'Runs the softer Anime4K B chain twice for blurry sources and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.' },
  CA: { optionKey: 'modeCaOption', optionLabel: 'Anime4K C+A · Denoise+Restore', descriptionKey: 'modeCaDescription', description: 'Denoises and upscales first, then restores and can upscale again, up to 4x. UL is a high-end GPU profile outside the 24 FPS baseline.' },
  REALESRGAN: { optionKey: 'modeRealEsrganOption', optionLabel: 'Real-ESRGAN · Max detail', descriptionKey: 'modeRealEsrganDescription', description: 'Fixed 4x ESRGAN-style network trained on anime video; best detail at the cost of very high GPU load. Intended for SD sources.' },
};

function optionFor(mode: EnhancementMode): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = mode;
  const presentation = MODE_PRESENTATIONS[mode];
  option.dataset.i18n = presentation.optionKey;
  option.dataset.i18nTitle = presentation.descriptionKey;
  option.textContent = message(presentation.optionKey, presentation.optionLabel);
  option.title = message(presentation.descriptionKey, presentation.description);
  return option;
}

function group(
  labelKey: string,
  labelFallback: string,
  modes: readonly EnhancementMode[],
): HTMLOptGroupElement {
  const element = document.createElement('optgroup');
  element.dataset.i18n = labelKey;
  element.label = message(labelKey, labelFallback);
  element.append(...modes.map(optionFor));
  return element;
}

export function populateModeSelect(
  select: HTMLSelectElement,
  requestedMode: unknown = 'A',
): EnhancementMode {
  const mode = isEnhancementMode(requestedMode) ? requestedMode : 'A';
  select.replaceChildren(
    optionFor('OFF'),
    group('anime4kModeGroup', 'Anime4K presets', ANIME4K_MODES),
    group('aiModeGroup', 'AI upscaling | GPU intensive', AI_UPSCALE_MODES),
  );
  select.value = mode;
  return mode;
}

export function renderModeDescription(
  mode: EnhancementMode,
  description: HTMLElement,
): void {
  const presentation = MODE_PRESENTATIONS[mode];
  description.textContent = message(presentation.descriptionKey, presentation.description);
}
