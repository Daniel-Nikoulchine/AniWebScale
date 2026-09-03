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
  CNNX2: { optionKey: 'modeCnnOption', optionLabel: 'Anime4K CNN · Sharp 2x', descriptionKey: 'modeCnnDescription', description: 'Official Anime4K CNN at a fixed 2x scale with medium GPU load. Produces a sharp result; Quality changes model size and GPU load.' },
  ARTCNN: { optionKey: 'modeArtCnnOption', optionLabel: 'ArtCNN · Line detail', descriptionKey: 'modeArtCnnDescription', description: 'Fixed 2x GLSL network for reconstructing anime line art and natural detail at real-time speed.' },
  ACNET: { optionKey: 'modeAcNetOption', optionLabel: 'ACNet · Fast', descriptionKey: 'modeAcNetDescription', description: 'Small fixed 2x GLSL network with very light GPU load. Prioritizes speed over maximum detail recovery.' },
  ARNET: { optionKey: 'modeArNetOption', optionLabel: 'ARNet · Strong detail', descriptionKey: 'modeArNetDescription', description: 'Deeper fixed 2x GLSL network with stronger detail recovery than ACNet at a balanced GPU load.' },
  REALESRGAN: { optionKey: 'modeRealEsrganOption', optionLabel: 'Real-ESRGAN · Max detail', descriptionKey: 'modeRealEsrganDescription', description: 'Fixed 4x ESRGAN-style network trained on anime video; best detail at the cost of very high GPU load. Intended for SD sources.' },
};

function optionFor(mode: EnhancementMode): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = mode;
  const presentation = MODE_PRESENTATIONS[mode];
  option.textContent = message(presentation.optionKey, presentation.optionLabel);
  option.title = message(presentation.descriptionKey, presentation.description);
  return option;
}

function group(label: string, modes: readonly EnhancementMode[]): HTMLOptGroupElement {
  const element = document.createElement('optgroup');
  element.label = label;
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
    group(message('anime4kModeGroup', 'Anime4K presets'), ANIME4K_MODES),
    group(message('aiModeGroup', 'AI upscaling | GPU intensive'), AI_UPSCALE_MODES),
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
