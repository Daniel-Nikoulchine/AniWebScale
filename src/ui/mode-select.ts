import type { EnhancementMode } from '../types';
import {
  AI_UPSCALE_MODES,
  ANIME4K_MODES,
  MODE_DESCRIPTIONS,
  isEnhancementMode,
} from '../shared/presets';

type ModeProfileTone = 'neutral' | 'recommended' | 'strong';

interface ModePresentation {
  optionLabel: string;
  profile: string;
  tone: ModeProfileTone;
}

export const MODE_PRESENTATIONS: Record<EnhancementMode, ModePresentation> = {
  OFF: { optionLabel: 'Off - No image enhancement', profile: 'Off', tone: 'neutral' },
  A: { optionLabel: 'Anime4K A - Balanced restore + 2x upscale (Recommended)', profile: 'Recommended', tone: 'recommended' },
  B: { optionLabel: 'Anime4K B - Soft restore + 2x upscale', profile: 'Soft sources', tone: 'neutral' },
  C: { optionLabel: 'Anime4K C - Denoise + 2x upscale', profile: 'Noisy sources', tone: 'neutral' },
  AA: { optionLabel: 'Anime4K A+A - Strong 2-pass restore + up to 4x', profile: 'Best at 2x+', tone: 'strong' },
  BB: { optionLabel: 'Anime4K B+B - Strong soft restore + up to 4x', profile: 'Best at 2x+', tone: 'strong' },
  CA: { optionLabel: 'Anime4K C+A - Denoise, restore + up to 4x', profile: 'Best at 2x+', tone: 'strong' },
  CNNX2: { optionLabel: 'Anime4K CNN 2x - Sharp neural upscale (GPU: medium)', profile: 'GPU: medium', tone: 'neutral' },
  ARTCNN: { optionLabel: 'ArtCNN C4F16 2x - Line/detail reconstruction (GPU: real-time)', profile: 'GPU: real-time', tone: 'recommended' },
  ACNET: { optionLabel: 'ACNet F8B4 2x - Fast lightweight upscale (GPU: very light)', profile: 'GPU: very light', tone: 'recommended' },
  ARNET: { optionLabel: 'ARNet F8B8 2x - Strong detail recovery (GPU: balanced)', profile: 'GPU: balanced', tone: 'strong' },
  ANIMEJANAI: { optionLabel: 'AnimeJaNai HD 2x - High-quality restoration (GPU: very high)', profile: 'Native recommended', tone: 'recommended' },
};

function optionFor(mode: EnhancementMode): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = mode;
  option.textContent = MODE_PRESENTATIONS[mode].optionLabel;
  option.title = MODE_DESCRIPTIONS[mode];
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
    group('Anime4K | Real-time presets', ANIME4K_MODES),
    group('AI upscaling | GPU intensive', AI_UPSCALE_MODES),
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
  profile.textContent = presentation.profile;
  profile.dataset.tone = presentation.tone;
}

export function renderModeDescription(
  mode: EnhancementMode,
  description: HTMLElement,
): void {
  description.textContent = MODE_DESCRIPTIONS[mode];
}
