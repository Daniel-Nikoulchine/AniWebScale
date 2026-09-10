import type { EnhancementMode } from '../types';
import { populateModeSelect } from './mode-select';
import { message } from './i18n';

export interface EnhancementSelects {
  mode: HTMLSelectElement;
  quality: HTMLSelectElement;
  backend: HTMLSelectElement;
  /** Only present when renderEnhancementSelects ran with the cap select. */
  realesrganCap?: HTMLSelectElement;
}

export interface ToggleSpec {
  id: string;
  titleKey: string;
  titleFallback: string;
  descriptionKey?: string;
  descriptionFallback?: string;
  compact?: boolean;
}

type SelectOption = { value: string; key: string; fallback: string };

const QUALITY_OPTIONS: readonly SelectOption[] = [
  { value: 'M', key: 'qualityTierMedium', fallback: 'Medium' },
  { value: 'VL', key: 'qualityTierVeryLarge', fallback: 'Very Large' },
  { value: 'UL', key: 'qualityTierUltraLarge', fallback: 'Ultra Large' },
];

const BACKEND_OPTIONS: readonly SelectOption[] = [
  { value: 'auto', key: 'backendAuto', fallback: 'Auto' },
  { value: 'webgpu', key: 'backendWebGpu', fallback: 'WebGPU (hardware acceleration required)' },
  { value: 'native', key: 'backendNative', fallback: 'Native Windows renderer (hardware acceleration off)' },
];

// RealESRGAN-Cap-Presets, gemessene Leiter vom 2.9. (Cap-Leiter im Report).
// 360 ist die Auto-Cap-Notfallstufe (REALESRGAN_CAP_LADDER): als Option drin,
// damit ein gespeicherter 360-Wert (E2E/manuelle Edits validieren ihn) kein
// leeres Select erzeugt — Init- und Live-Sync-Pfad stimmen dann überein.
const REALESRGAN_CAP_OPTIONS: readonly SelectOption[] = [
  { value: '480', key: 'realesrganCap480', fallback: '480p · Max detail (~16 fps)' },
  { value: '432', key: 'realesrganCap432', fallback: '432p · Balanced (~21 fps)' },
  { value: '405', key: 'realesrganCap405', fallback: '405p · Max speed (~26 fps)' },
  { value: '360', key: 'realesrganCap360', fallback: '360p · Emergency (~30 fps)' },
];

function createSelectField(
  labelKey: string,
  labelFallback: string,
  id: string,
  options: readonly SelectOption[],
): HTMLLabelElement {
  const label = document.createElement('label');
  const title = document.createElement('span');
  title.dataset.i18n = labelKey;
  title.textContent = message(labelKey, labelFallback);

  const select = document.createElement('select');
  select.id = id;
  select.className = 'ui-select';
  for (const optionData of options) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.dataset.i18n = optionData.key;
    option.textContent = message(optionData.key, optionData.fallback);
    select.appendChild(option);
  }

  label.append(title, select);
  return label;
}

function updateSelectLabels(select: HTMLSelectElement): void {
  select.querySelectorAll<HTMLOptionElement>('[data-i18n]').forEach(option => {
    option.textContent = message(option.dataset.i18n || '', option.textContent || '');
  });
  const label = select.parentElement?.querySelector<HTMLElement>(':scope > span[data-i18n]');
  if (label) label.textContent = message(label.dataset.i18n || '', label.textContent || '');
}

export function refreshEnhancementControlLabels(controls: EnhancementSelects): void {
  updateSelectLabels(controls.quality);
  updateSelectLabels(controls.backend);
  if (controls.realesrganCap) updateSelectLabels(controls.realesrganCap);
  populateModeSelect(controls.mode, controls.mode.value);
}

export function renderEnhancementSelects(
  root: HTMLElement,
  requestedMode: EnhancementMode = 'A',
  options: { includeRealEsrganCap?: boolean } = {},
): EnhancementSelects {
  root.replaceChildren();

  const modeLabel = document.createElement('label');
  modeLabel.className = 'mode-select-field';
  const modeTitle = document.createElement('span');
  modeTitle.dataset.i18n = 'enhancementMode';
  modeTitle.textContent = message('enhancementMode', 'Enhancement mode');
  const mode = document.createElement('select');
  mode.id = 'mode';
  mode.className = 'ui-select';
  modeLabel.append(modeTitle, mode);
  populateModeSelect(mode, requestedMode);

  const qualityLabel = createSelectField('quality', 'Quality', 'quality', QUALITY_OPTIONS);
  const backendLabel = createSelectField('backend', 'Backend', 'backend', BACKEND_OPTIONS);
  const quality = qualityLabel.querySelector('select') as HTMLSelectElement;
  const backend = backendLabel.querySelector('select') as HTMLSelectElement;

  root.append(modeLabel, qualityLabel, backendLabel);
  if (options.includeRealEsrganCap === false) return { mode, quality, backend };
  const capLabel = createSelectField(
    'realesrganCap', 'Real-ESRGAN detail', 'realesrgan-cap', REALESRGAN_CAP_OPTIONS,
  );
  const realesrganCap = capLabel.querySelector('select') as HTMLSelectElement;
  root.append(capLabel);
  return { mode, quality, backend, realesrganCap };
}

export function renderToggle(root: HTMLElement, spec: ToggleSpec): HTMLInputElement {
  const label = document.createElement('label');
  label.className = spec.compact ? 'ui-toggle ui-toggle-compact' : 'ui-toggle';

  const input = document.createElement('input');
  input.id = spec.id;
  input.type = 'checkbox';

  const control = document.createElement('span');
  control.className = 'check-control';

  const content = document.createElement('span');
  const title = document.createElement('strong');
  title.dataset.i18n = spec.titleKey;
  title.textContent = message(spec.titleKey, spec.titleFallback);
  content.appendChild(title);

  if (spec.descriptionFallback !== undefined) {
    const description = document.createElement('small');
    if (spec.descriptionKey) description.dataset.i18n = spec.descriptionKey;
    if (spec.id === 'frame-generation') description.id = 'frame-generation-description';
    description.textContent = message(spec.descriptionKey || '', spec.descriptionFallback);
    content.appendChild(description);
  }

  label.append(input, control, content);
  root.appendChild(label);
  return input;
}

export function renderEnhancementToggles(
  root: HTMLElement,
  options: { includeStatistics: boolean; compact?: boolean },
): { frameGeneration: HTMLInputElement; statistics?: HTMLInputElement } {
  root.replaceChildren();
  const frameGeneration = renderToggle(root, {
    id: 'frame-generation',
    titleKey: 'frameGeneration',
    titleFallback: 'Frame generation',
    descriptionKey: 'frameMotion2xEvenOff',
    descriptionFallback: 'Motion-aware 2x, even while enhancement is off.',
    compact: options.compact,
  });

  if (!options.includeStatistics) return { frameGeneration };

  const statistics = renderToggle(root, {
    id: 'statistics',
    titleKey: 'liveStatistics',
    titleFallback: 'Live statistics',
    descriptionFallback: 'FPS, timing and dropped frames',
    compact: options.compact,
  });
  return { frameGeneration, statistics };
}
