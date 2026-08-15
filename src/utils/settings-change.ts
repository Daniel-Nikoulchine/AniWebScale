/**
 * The single source of truth for which storage keys trigger a renderer
 * settings change. Popup/options write to storage; content scripts watch
 * storage.onChanged; the background patches the native host. Keeping this
 * list in one place prevents drift between the three consumers.
 */
export const RENDER_SETTING_KEYS = new Set([
  'extensionEnabled',
  'mode',
  'quality',
  'output',
  'backend',
  'statsEnabled',
  'autoFullscreenEnabled',
  'frameGenerationEnabled',
  'selectedModeId',
]);

export function isRenderSettingKey(key: string): boolean {
  return RENDER_SETTING_KEYS.has(key);
}

export function shouldApplySettingsChange(
  changes: Record<string, unknown>,
  areaName: string,
): boolean {
  return areaName === 'local' && Object.keys(changes).some(key => RENDER_SETTING_KEYS.has(key));
}

/** True when the change contains any key that can affect the active pipeline. */
export function containsRenderSettingChange(changes: Record<string, unknown>): boolean {
  return Object.keys(changes).some(key => RENDER_SETTING_KEYS.has(key));
}
