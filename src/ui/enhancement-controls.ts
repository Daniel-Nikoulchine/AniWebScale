import type { EnhancementMode } from '../types';
import { populateModeSelect } from './mode-select';
import { message } from './i18n';

export interface EnhancementSelects {
  mode: HTMLSelectElement;
  quality: HTMLSelectElement;
  backend: HTMLSelectElement;
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
  populateModeSelect(controls.mode, controls.mode.value);
}

export function renderEnhancementSelects(
  root: HTMLElement,
  requestedMode: EnhancementMode = 'A',
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
  return { mode, quality, backend };
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
