import enCatalogJson from '../../public/_locales/en/messages.json';
import deCatalogJson from '../../public/_locales/de/messages.json';

export type UiLanguage = 'auto' | 'en' | 'de';

interface CatalogEntry {
  message: string;
}

type Catalog = Record<string, CatalogEntry>;

const CATALOGS: Record<'en' | 'de', Catalog> = {
  en: enCatalogJson as unknown as Catalog,
  de: deCatalogJson as unknown as Catalog,
};

const STORAGE_KEY = 'uiLanguage';

let uiLanguage: UiLanguage = 'auto';
let resolvedLanguage: 'en' | 'de' = browserUiLanguage();

function browserUiLanguage(): 'en' | 'de' {
  const raw = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
    ? chrome.i18n.getUILanguage()
    : 'en';
  return raw.split('-', 1)[0] === 'de' ? 'de' : 'en';
}

function applyLanguage(value: unknown): void {
  uiLanguage = value === 'en' || value === 'de' ? value : 'auto';
  resolvedLanguage = uiLanguage === 'auto' ? browserUiLanguage() : uiLanguage;
}

/**
 * The language the page surfaces should resolve to: the user's explicit
 * choice (en/de), or the browser UI language when set to 'auto'.
 */
export function getResolvedLanguage(): 'en' | 'de' {
  return resolvedLanguage;
}

/**
 * The stored preference as chosen in the UI. 'auto' means "follow the
 * browser UI language"; used to prefill the language selector.
 */
export function getUiLanguage(): UiLanguage {
  return uiLanguage;
}

/**
 * Load the stored preference before the first localizeDocument() call.
 * Called once at page start; resolveLanguage falls back to the browser UI
 * language when chrome.storage is unavailable.
 */
export async function initI18n(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    applyLanguage(result[STORAGE_KEY]);
  } catch {
    // Storage unavailable: keep the browser default.
  }
}

/**
 * Persist the choice and switch the catalog immediately, so the current
 * page can re-localize without a reload.
 */
export async function setUiLanguage(language: UiLanguage): Promise<void> {
  applyLanguage(language);
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: language });
  } catch {
    // Only the in-memory override sticks. Good enough for this session.
  }
}

export function message(
  key: string,
  fallback = '',
  replacements: Record<string, string | number> = {},
): string {
  const value = CATALOGS[resolvedLanguage]?.[key]?.message
    || (typeof chrome !== 'undefined' && chrome.i18n?.getMessage ? chrome.i18n.getMessage(key) : '');
  return Object.entries(replacements).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    value || fallback,
  );
}

export function localizeDocument(root: Document = document): void {
  root.documentElement.lang = resolvedLanguage;
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n || '';
    const translated = message(key);
    if (translated) element.textContent = translated;
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach(element => {
    const key = element.dataset.i18nAriaLabel || '';
    const translated = message(key);
    if (translated) element.setAttribute('aria-label', translated);
  });
}
