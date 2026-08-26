import type { Anime4KWebExtSettings, LocalSettings } from '../types';
import { settingsUpdatedMessage } from '../shared/runtime-messages';
import { parseStatusResponse } from '../shared/runtime-messages';
import { saveLocalSettings, saveSettings } from './settings';

export type SettingsApplyResult = 'applied' | 'saved-not-applied' | 'failed';

/** The only settings shape UI surfaces may submit for persistence. */
export type SettingsUpdate = Partial<Anime4KWebExtSettings>;

/** Local-only values saved together with a render settings update. */
export interface SettingsApplyOptions {
  local?: Partial<LocalSettings>;
}

/**
 * The one home for "save settings and make them take effect": persist the
 * render settings (plus any local-only flags), notify the background and
 * report the three-phase outcome. UI pages collect fields; they no longer
 * compose save/notify/error tiers themselves.
 */
let applyChain: Promise<unknown> = Promise.resolve();

export function applySettings(
  update: SettingsUpdate,
  options: SettingsApplyOptions = {},
): Promise<SettingsApplyResult> {
  const result = applyChain.then(
    () => applySettingsNow(update, options.local ?? {}),
    () => applySettingsNow(update, options.local ?? {}),
  );
  applyChain = result.then(() => undefined, () => undefined);
  return result;
}

async function applySettingsNow(
  update: SettingsUpdate,
  extraLocal: Partial<LocalSettings>,
): Promise<SettingsApplyResult> {
  try {
    await saveSettings(update);
    if (Object.keys(extraLocal).length > 0) await saveLocalSettings(extraLocal);
  } catch {
    return 'failed';
  }

  try {
    const response = await chrome.runtime.sendMessage(settingsUpdatedMessage());
    const status = parseStatusResponse(response);
    return status.ok ? 'applied' : 'saved-not-applied';
  } catch {
    // The settings are durable; only the live application (active renderer
    // or background session) could not be reached or refused them.
    return 'saved-not-applied';
  }
}
