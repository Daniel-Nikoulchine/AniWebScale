import { describe, expect, it } from 'vitest';
import { ENHANCEMENT_MODES, MODE_DESCRIPTIONS } from '../src/shared/presets';
import { MODE_PRESENTATIONS } from '../src/ui/mode-select';
import { backendPlanLabel, modePlanLabel } from '../src/ui/plan-access';

describe('enhancement mode descriptions', () => {
  it('gives every selectable mode a descriptive option label and detailed explanation', () => {
    expect(Object.keys(MODE_PRESENTATIONS)).toEqual(ENHANCEMENT_MODES);
    expect(Object.keys(MODE_DESCRIPTIONS)).toEqual(ENHANCEMENT_MODES);

    for (const mode of ENHANCEMENT_MODES) {
      expect(MODE_PRESENTATIONS[mode].optionLabel, `${mode} option label`).toContain(' - ');
      expect(MODE_PRESENTATIONS[mode].optionLabel.length, `${mode} option label`).toBeGreaterThan(20);
      expect(MODE_DESCRIPTIONS[mode].length, `${mode} detailed description`).toBeGreaterThan(60);
    }
  });

  it('labels Free-plan restrictions directly instead of relying on disabled controls', () => {
    expect(modePlanLabel('ARTCNN', false)).toContain('— Pro');
    expect(modePlanLabel('ARTCNN', true)).toBe(MODE_PRESENTATIONS.ARTCNN.optionLabel);
    expect(modePlanLabel('A', false)).toBe(MODE_PRESENTATIONS.A.optionLabel);
    expect(backendPlanLabel('auto', false)).toBe('Auto — Pro');
    expect(backendPlanLabel('native', false)).toBe('Native Windows renderer — Pro');
    expect(backendPlanLabel('webgpu', false)).toBe('WebGPU (hardware acceleration required)');
  });
});
