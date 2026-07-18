import { LICENSE_STORAGE_KEY } from '../account/entitlement';

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
  LICENSE_STORAGE_KEY,
]);

export function shouldApplySettingsChange(
  changes: Record<string, unknown>,
  areaName: string,
): boolean {
  return areaName === 'local' && Object.keys(changes).some(key => RENDER_SETTING_KEYS.has(key));
}
