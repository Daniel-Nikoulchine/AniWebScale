import { describe, expect, it } from 'vitest';
import {
  containsRenderSettingChange,
  isRenderSettingKey,
  shouldApplySettingsChange,
  RENDER_SETTING_KEYS,
} from '../src/utils/settings-change';

describe('settings storage change routing', () => {
  it.each([
    'extensionEnabled',
    'mode',
    'quality',
    'output',
    'backend',
    'statsEnabled',
    'autoFullscreenEnabled',
    'frameGenerationEnabled',
    'selectedModeId',
  ])('applies relevant local key %s', key => {
    expect(shouldApplySettingsChange({ [key]: { oldValue: null, newValue: true } }, 'local')).toBe(true);
    expect(isRenderSettingKey(key)).toBe(true);
    expect(RENDER_SETTING_KEYS.has(key)).toBe(true);
  });

  it.each([
    'aniwebscaleActiveEnhancementV1',
    'anime4kNativeSessionV3',
    'anime4kNativeConsentByOrigin',
    'theme',
    '_configVersion',
    'verboseLogging',
  ])('ignores internal local key %s', key => {
    expect(shouldApplySettingsChange({ [key]: { oldValue: null, newValue: true } }, 'local')).toBe(false);
    expect(isRenderSettingKey(key)).toBe(false);
  });

  it('ignores historical sync events even for a preference key', () => {
    expect(shouldApplySettingsChange({ extensionEnabled: { newValue: false } }, 'sync')).toBe(false);
  });

  it('containsRenderSettingChange detects at least one render key', () => {
    expect(containsRenderSettingChange({ mode: { newValue: 'B' } })).toBe(true);
    expect(containsRenderSettingChange({ theme: { newValue: 'dark' } })).toBe(false);
    expect(containsRenderSettingChange({})).toBe(false);
  });

  it('autoFullscreenEnabled is a render key (drift regression)', () => {
    // The key list used to miss autoFullscreenEnabled while getSettings()
    // and migration carried it. Changing the fullscreen toggle must re-apply.
    expect(shouldApplySettingsChange({ autoFullscreenEnabled: { oldValue: true, newValue: false } }, 'local')).toBe(true);
  });
});
