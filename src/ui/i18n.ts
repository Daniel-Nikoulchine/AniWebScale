import enCatalogJson from '../../public/_locales/en/messages.json';
import deCatalogJson from '../../public/_locales/de/messages.json';
import { isUiLanguage, type UiLanguage } from '../utils/local-settings';

// NOTE: the native-capture prompt string lives in src/shared/native-consent.ts
// (not owned by this module). Its catalog key `nativeConsentPrompt` is already
// published here so that file can switch to message('nativeConsentPrompt', ...)
// once it moves onto the shared i18n seam.

export type { UiLanguage };

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
  uiLanguage = isUiLanguage(value) ? value : 'auto';
  resolvedLanguage = uiLanguage === 'auto' ? browserUiLanguage() : uiLanguage;
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

/**
 * The declared localized-attribute set. `localizeDocument` is data-driven over
 * it, so a new binding is one table row rather than a new query loop.
 */
type LocalizedApplier = (element: HTMLElement, value: string) => void;

const LOCALIZED_ATTRIBUTES: ReadonlyArray<{ attribute: string; apply: LocalizedApplier }> = [
  {
    attribute: 'data-i18n',
    apply: (element, value) => {
      // Setting textContent on an <optgroup> would drop its options; its
      // label is the localizable surface instead.
      if (element instanceof HTMLOptGroupElement) element.label = value;
      else element.textContent = value;
    },
  },
  { attribute: 'data-i18n-title', apply: (element, value) => element.setAttribute('title', value) },
  { attribute: 'data-i18n-placeholder', apply: (element, value) => element.setAttribute('placeholder', value) },
  { attribute: 'data-i18n-aria-label', apply: (element, value) => element.setAttribute('aria-label', value) },
];

export function localizeDocument(root: ParentNode = document): void {
  if (root instanceof Document) root.documentElement.lang = resolvedLanguage;
  for (const { attribute, apply } of LOCALIZED_ATTRIBUTES) {
    root.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach(element => {
      const key = element.getAttribute(attribute) || '';
      const translated = message(key);
      if (translated) apply(element, translated);
    });
  }
}

/**
 * Re-apply the current catalog to the live DOM, including dynamically rebuilt
 * selects whose options carry the declared data attributes.
 */
export function relocalize(root: ParentNode = document): void {
  localizeDocument(root);
}
