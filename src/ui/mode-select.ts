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
  OFF: { optionKey: 'modeOffOption', optionLabel: 'Off - No image enhancement', descriptionKey: 'modeOffDescription', description: 'Disables image enhancement. Frame generation can still be enabled separately.' },
  A: { optionKey: 'modeAOption', optionLabel: 'Anime4K A - Balanced restore + 2x upscale (Recommended)', descriptionKey: 'modeADescription', description: 'Restores line detail, then applies Anime4K CNN upscaling. The balanced default for most anime.' },
  B: { optionKey: 'modeBOption', optionLabel: 'Anime4K B - Soft restore + 2x upscale', descriptionKey: 'modeBDescription', description: 'Uses softer restoration before Anime4K CNN upscaling to reduce ringing on blurry or compressed video.' },
  C: { optionKey: 'modeCOption', optionLabel: 'Anime4K C - Denoise + 2x upscale', descriptionKey: 'modeCDescription', description: 'Denoises and upscales in one Anime4K CNN pass. Best suited to visibly noisy animation.' },
  AA: { optionKey: 'modeAaOption', optionLabel: 'Anime4K A+A - Strong 2-pass restore + up to 4x', descriptionKey: 'modeAaDescription', description: 'Runs the Anime4K A restoration chain twice for stronger detail and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.' },
  BB: { optionKey: 'modeBbOption', optionLabel: 'Anime4K B+B - Strong soft restore + up to 4x', descriptionKey: 'modeBbDescription', description: 'Runs the softer Anime4K B chain twice for blurry sources and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.' },
  CA: { optionKey: 'modeCaOption', optionLabel: 'Anime4K C+A - Denoise, restore + up to 4x', descriptionKey: 'modeCaDescription', description: 'Denoises and upscales first, then restores and can upscale again. UL is a high-end GPU profile outside the 24 FPS baseline.' },
  CNNX2: { optionKey: 'modeCnnOption', optionLabel: 'Anime4K CNN 2x - Sharp neural upscale (GPU: medium)', descriptionKey: 'modeCnnDescription', description: 'Official Anime4K CNN at a fixed 2x scale. Produces a sharp result; Quality changes model size and GPU load.' },
  ARTCNN: { optionKey: 'modeArtCnnOption', optionLabel: 'ArtCNN C4F16 2x - Line/detail reconstruction (GPU: real-time)', descriptionKey: 'modeArtCnnDescription', description: 'Fixed 2x GLSL network for reconstructing anime line art and natural detail at real-time speed.' },
  ACNET: { optionKey: 'modeAcNetOption', optionLabel: 'ACNet F8B4 2x - Fast lightweight upscale (GPU: very light)', descriptionKey: 'modeAcNetDescription', description: 'Small fixed 2x GLSL network that prioritizes speed and very low GPU load over maximum detail recovery.' },
  ARNET: { optionKey: 'modeArNetOption', optionLabel: 'ARNet F8B8 2x - Strong detail recovery (GPU: balanced)', descriptionKey: 'modeArNetDescription', description: 'Deeper fixed 2x GLSL network with stronger detail recovery than ACNet at a higher, balanced GPU load.' },
  REALESRGAN: { optionKey: 'modeRealEsrganOption', optionLabel: 'Real-ESRGAN AnimeVideo v3 4x - Max detail (GPU: very heavy, SD sources)', descriptionKey: 'modeRealEsrganDescription', description: 'Fixed 4x ESRGAN-style network trained on anime video; best detail at the cost of high GPU load, intended for SD sources.' },
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
