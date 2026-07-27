import type { EnhancementMode, RenderBackend } from '../types';
import { isEnhancementMode } from '../shared/presets';
import { isProMode } from '../account/entitlement';
import { MODE_PRESENTATIONS } from './mode-select';
import { message } from './i18n';

const BACKEND_LABELS: Record<RenderBackend, { key: string; fallback: string }> = {
  auto: { key: 'backendAuto', fallback: 'Auto' },
  webgpu: { key: 'backendWebGpu', fallback: 'WebGPU (hardware acceleration required)' },
  native: { key: 'backendNative', fallback: 'Native Windows renderer' },
};

export function modePlanLabel(mode: EnhancementMode, hasPro: boolean): string {
  const presentation = MODE_PRESENTATIONS[mode];
  const label = message(presentation.optionKey, presentation.optionLabel);
  return !hasPro && isProMode(mode) ? message('proSuffix', '{label} — Pro', { label }) : label;
}

export function backendPlanLabel(backend: RenderBackend, hasPro: boolean): string {
  const presentation = BACKEND_LABELS[backend];
  const label = message(presentation.key, presentation.fallback);
  return !hasPro && backend !== 'webgpu' ? message('proSuffix', '{label} — Pro', { label }) : label;
}

export function renderPlanAccessLabels(
  modeSelect: HTMLSelectElement,
  backendSelect: HTMLSelectElement,
  frameGeneration: HTMLInputElement,
  frameGenerationDescription: HTMLElement,
  hasPro: boolean,
  frameDescription: string,
): void {
  modeSelect.querySelectorAll('option').forEach(option => {
    if (!isEnhancementMode(option.value)) return;
    option.textContent = modePlanLabel(option.value, hasPro);
  });

  const aiGroup = Array.from(modeSelect.querySelectorAll('optgroup')).find(group =>
    Array.from(group.querySelectorAll('option')).some(option =>
      isEnhancementMode(option.value) && isProMode(option.value),
    ),
  );
  if (aiGroup) aiGroup.label = hasPro
    ? message('aiModeGroup', 'AI upscaling | GPU intensive')
    : message('aiModeGroupPro', 'AI upscaling | Pro plan');

  Array.from(backendSelect.options).forEach(option => {
    if (option.value !== 'auto' && option.value !== 'webgpu' && option.value !== 'native') return;
    option.textContent = backendPlanLabel(option.value, hasPro);
  });

  frameGenerationDescription.textContent = hasPro
    ? frameDescription
    : message('proFeaturePrefix', 'Pro feature · {description}', { description: frameDescription });
  const row = frameGeneration.closest('label');
  if (row) row.dataset.planLocked = String(!hasPro);
}
