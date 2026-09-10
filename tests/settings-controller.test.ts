// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  collectRenderSettings,
  defaultForKey,
  syncRenderSettings,
  type RenderControlElements,
} from '../src/ui/settings-controller';

function makeSelect(values: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    select.appendChild(option);
  }
  return select;
}

function makeControls(): RenderControlElements {
  const statistics = document.createElement('input');
  statistics.type = 'checkbox';
  const frameGeneration = document.createElement('input');
  frameGeneration.type = 'checkbox';
  return {
    mode: makeSelect(['OFF', 'A', 'B']),
    quality: makeSelect(['M', 'VL', 'UL']),
    backend: makeSelect(['auto', 'webgpu', 'native']),
    realesrganCap: makeSelect(['480', '432', '405', '360']),
    statistics,
    frameGeneration,
  };
}

describe('defaultForKey', () => {
  it('returns the schema default for every render key', () => {
    expect(defaultForKey('mode')).toBe('A');
    expect(defaultForKey('quality')).toBe('M');
    expect(defaultForKey('backend')).toBe('auto');
    expect(defaultForKey('realesrganCapHeight')).toBe(480);
    expect(defaultForKey('statsEnabled')).toBe(false);
    expect(defaultForKey('frameGenerationEnabled')).toBe(false);
    expect(defaultForKey('extensionEnabled')).toBe(true);
    expect(defaultForKey('autoFullscreenEnabled')).toBe(true);
    expect(defaultForKey('verboseLogging')).toBe(false);
  });

  it('returns undefined for keys without a built-in default', () => {
    expect(defaultForKey('theme')).toBeUndefined();
    expect(defaultForKey('selectedModeId')).toBeUndefined();
  });
});

describe('syncRenderSettings', () => {
  it('applies string, numeric and boolean changes to their controls', () => {
    const controls = makeControls();
    const changed = syncRenderSettings({
      mode: { newValue: 'B' },
      realesrganCapHeight: { newValue: 432 },
      statsEnabled: { newValue: true },
    }, controls);

    expect(changed).toBe(true);
    expect(controls.mode.value).toBe('B');
    expect(controls.realesrganCap?.value).toBe('432');
    expect(controls.statistics.checked).toBe(true);
  });

  it('falls back to the built-in default when a key is removed', () => {
    const controls = makeControls();
    controls.mode.value = 'B';
    controls.statistics.checked = true;

    const changed = syncRenderSettings({
      mode: { newValue: undefined },
      statsEnabled: { newValue: undefined },
    }, controls);

    expect(changed).toBe(true);
    expect(controls.mode.value).toBe('A');
    expect(controls.statistics.checked).toBe(false);
  });

  it('skips a corrupt value that matches no option instead of blanking the select', () => {
    const controls = makeControls();
    controls.mode.value = 'B';

    const changed = syncRenderSettings({ mode: { newValue: 'NOPE' } }, controls);

    expect(changed).toBe(false);
    expect(controls.mode.value).toBe('B');
  });

  it('reports no change when the bound controls already match', () => {
    const controls = makeControls();
    controls.mode.value = 'A';
    expect(syncRenderSettings({ mode: { newValue: 'A' } }, controls)).toBe(false);
  });

  it('collects the render settings from the controls', () => {
    const controls = makeControls();
    controls.mode.value = 'B';
    controls.quality.value = 'UL';
    controls.backend.value = 'native';
    controls.realesrganCap!.value = '405';
    controls.statistics.checked = true;
    controls.frameGeneration.checked = true;

    expect(collectRenderSettings(controls)).toEqual({
      mode: 'B',
      quality: 'UL',
      backend: 'native',
      statsEnabled: true,
      frameGenerationEnabled: true,
      realesrganCapHeight: 405,
    });
  });
});
