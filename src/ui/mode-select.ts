import type { EnhancementMode } from '../types';
import {
  AI_UPSCALE_MODES,
  ANIME4K_MODES,
  isEnhancementMode,
} from '../shared/presets';
import { message } from './i18n';

type ModeProfileTone = 'neutral' | 'recommended' | 'strong';

interface ModePresentation {
  optionKey: string;
  optionLabel: string;
  profileKey: string;
  profile: string;
  descriptionKey: string;
  description: string;
  tone: ModeProfileTone;
}

export const MODE_PRESENTATIONS: Record<EnhancementMode, ModePresentation> = {
  OFF: { optionKey: 'modeOffOption', optionLabel: 'Off - No image enhancement', profileKey: 'profileOff', profile: 'Off', descriptionKey: 'modeOffDescription', description: 'Disables image enhancement. Frame generation can still be enabled separately.', tone: 'neutral' },
  A: { optionKey: 'modeAOption', optionLabel: 'Anime4K A - Balanced restore + 2x upscale (Recommended)', profileKey: 'profileRecommended', profile: 'Recommended', descriptionKey: 'modeADescription', description: 'Restores line detail, then applies Anime4K CNN upscaling. The balanced default for most anime.', tone: 'recommended' },
  B: { optionKey: 'modeBOption', optionLabel: 'Anime4K B - Soft restore + 2x upscale', profileKey: 'profileSoftSources', profile: 'Soft sources', descriptionKey: 'modeBDescription', description: 'Uses softer restoration before Anime4K CNN upscaling to reduce ringing on blurry or compressed video.', tone: 'neutral' },
  C: { optionKey: 'modeCOption', optionLabel: 'Anime4K C - Denoise + 2x upscale', profileKey: 'profileNoisySources', profile: 'Noisy sources', descriptionKey: 'modeCDescription', description: 'Denoises and upscales in one Anime4K CNN pass. Best suited to visibly noisy animation.', tone: 'neutral' },
  AA: { optionKey: 'modeAaOption', optionLabel: 'Anime4K A+A - Strong 2-pass restore + up to 4x', profileKey: 'profileBestAt2x', profile: 'Best at 2x+', descriptionKey: 'modeAaDescription', description: 'Runs the Anime4K A restoration chain twice for stronger detail and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.', tone: 'strong' },
  BB: { optionKey: 'modeBbOption', optionLabel: 'Anime4K B+B - Strong soft restore + up to 4x', profileKey: 'profileBestAt2x', profile: 'Best at 2x+', descriptionKey: 'modeBbDescription', description: 'Runs the softer Anime4K B chain twice for blurry sources and up to 4x scaling. UL is a high-end GPU profile outside the 24 FPS baseline.', tone: 'strong' },
  CA: { optionKey: 'modeCaOption', optionLabel: 'Anime4K C+A - Denoise, restore + up to 4x', profileKey: 'profileBestAt2x', profile: 'Best at 2x+', descriptionKey: 'modeCaDescription', description: 'Denoises and upscales first, then restores and can upscale again. UL is a high-end GPU profile outside the 24 FPS baseline.', tone: 'strong' },
  CNNX2: { optionKey: 'modeCnnOption', optionLabel: 'Anime4K CNN 2x - Sharp neural upscale (GPU: medium)', profileKey: 'profileGpuMedium', profile: 'GPU: medium', descriptionKey: 'modeCnnDescription', description: 'Official Anime4K CNN at a fixed 2x scale. Produces a sharp result; Quality changes model size and GPU load.', tone: 'neutral' },
  ARTCNN: { optionKey: 'modeArtCnnOption', optionLabel: 'ArtCNN C4F16 2x - Line/detail reconstruction (GPU: real-time)', profileKey: 'profileGpuRealtime', profile: 'GPU: real-time', descriptionKey: 'modeArtCnnDescription', description: 'Fixed 2x GLSL network for reconstructing anime line art and natural detail at real-time speed.', tone: 'recommended' },
  ACNET: { optionKey: 'modeAcNetOption', optionLabel: 'ACNet F8B4 2x - Fast lightweight upscale (GPU: very light)', profileKey: 'profileGpuVeryLight', profile: 'GPU: very light', descriptionKey: 'modeAcNetDescription', description: 'Small fixed 2x GLSL network that prioritizes speed and very low GPU load over maximum detail recovery.', tone: 'recommended' },
  ARNET: { optionKey: 'modeArNetOption', optionLabel: 'ARNet F8B8 2x - Strong detail recovery (GPU: balanced)', profileKey: 'profileGpuBalanced', profile: 'GPU: balanced', descriptionKey: 'modeArNetDescription', description: 'Deeper fixed 2x GLSL network with stronger detail recovery than ACNet at a higher, balanced GPU load.', tone: 'strong' },
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

export function renderModeSummary(
  mode: EnhancementMode,
  description: HTMLElement,
  profile: HTMLElement,
): void {
  const presentation = MODE_PRESENTATIONS[mode];
  renderModeDescription(mode, description);
  profile.textContent = message(presentation.profileKey, presentation.profile);
  profile.dataset.tone = presentation.tone;
}

export function renderModeDescription(
  mode: EnhancementMode,
  description: HTMLElement,
): void {
  const presentation = MODE_PRESENTATIONS[mode];
  description.textContent = message(presentation.descriptionKey, presentation.description);
}
