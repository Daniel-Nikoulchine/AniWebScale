import { describe, expect, it } from 'vitest';
import { shouldApplySettingsChange } from '../src/utils/settings-change';

describe('settings storage change routing', () => {
  it.each([
    'extensionEnabled',
    'mode',
    'quality',
    'backend',
    'frameGenerationEnabled',
  ])('applies relevant local key %s', key => {
    expect(shouldApplySettingsChange({ [key]: { oldValue: null, newValue: true } }, 'local')).toBe(true);
  });

  it.each([
    'aniwebscaleActiveEnhancementV1',
    'anime4kNativeSessionV3',
    'anime4kNativeConsentByOrigin',
    'theme',
  ])('ignores internal local key %s', key => {
    expect(shouldApplySettingsChange({ [key]: { oldValue: null, newValue: true } }, 'local')).toBe(false);
  });

  it('ignores historical sync events even for a preference key', () => {
    expect(shouldApplySettingsChange({ extensionEnabled: { newValue: false } }, 'sync')).toBe(false);
  });
});
