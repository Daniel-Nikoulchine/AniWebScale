import { describe, expect, it } from 'vitest';
import { ENHANCEMENT_MODES, MODE_DESCRIPTIONS } from '../src/shared/presets';
import { MODE_PRESENTATIONS } from '../src/ui/mode-select';

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
});
