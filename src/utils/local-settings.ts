import type { LocalSettings } from '../types';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type UiLanguage = 'auto' | 'en' | 'de';

export const THEME_MODES = ['light', 'dark', 'auto'] as const;
export const UI_LANGUAGES = ['auto', 'en', 'de'] as const;

export const DEFAULT_THEME: ThemeMode = 'auto';
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'auto';

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value);
}

/** Reading a stored theme falls back to the default instead of re-validating. */
export function readTheme(stored: Record<string, unknown>): ThemeMode {
  return isThemeMode(stored.theme) ? stored.theme : DEFAULT_THEME;
}

export function readUiLanguage(stored: Record<string, unknown>): UiLanguage {
  return isUiLanguage(stored.uiLanguage) ? stored.uiLanguage : DEFAULT_UI_LANGUAGE;
}

export function readVerboseLogging(stored: Record<string, unknown>): boolean {
  return stored.verboseLogging === true;
}

export type OnboardingFlags = Pick<LocalSettings, 'hasCompletedOnboarding' | 'siteAccessModelAcknowledged'>;

export function readOnboardingFlags(stored: Record<string, unknown>): OnboardingFlags {
  return {
    hasCompletedOnboarding: stored.hasCompletedOnboarding === true,
    siteAccessModelAcknowledged: stored.siteAccessModelAcknowledged === true,
  };
}
