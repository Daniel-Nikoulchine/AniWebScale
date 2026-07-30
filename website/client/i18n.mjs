let catalog = {};

const STORAGE_KEY = 'aniwebscale-lang';

function resolveLanguage() {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'de' || requested === 'en') {
    try { localStorage.setItem(STORAGE_KEY, requested); } catch { /* private mode */ }
    return requested;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch { /* private mode */ }
  const browser = navigator.languages?.[0] || navigator.language || 'en';
  return browser.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function t(key, fallback = '', replacements = {}) {
  const template = catalog[key]?.message || fallback;
  return Object.entries(replacements).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    template,
  );
}

export function setLanguage(lang) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }
  window.location.reload();
}

export async function loadLocalization(root = document) {
  const language = resolveLanguage();
  const response = await fetch(`/locales/${language}.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Localization catalog unavailable (${response.status}).`);
  catalog = await response.json();
  root.documentElement.lang = language;
  root.querySelectorAll('[data-i18n]').forEach(element => {
    const translated = t(element.dataset.i18n);
    if (translated) element.innerHTML = translated;
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const translated = t(element.dataset.i18nAriaLabel);
    if (translated) element.setAttribute('aria-label', translated);
  });
  // Highlight the active language in any [data-lang-toggle] buttons
  root.querySelectorAll('[data-lang-toggle]').forEach(button => {
    button.classList.toggle('active', button.dataset.langToggle === language);
    button.setAttribute('aria-pressed', String(button.dataset.langToggle === language));
  });
}
