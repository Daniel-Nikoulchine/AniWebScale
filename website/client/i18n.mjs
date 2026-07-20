let catalog = {};

function browserLanguage() {
  const requested = new URLSearchParams(window.location.search).get('lang');
  const language = requested || navigator.languages?.[0] || navigator.language || 'en';
  return language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function t(key, fallback = '', replacements = {}) {
  const template = catalog[key]?.message || fallback;
  return Object.entries(replacements).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    template,
  );
}

export async function loadLocalization(root = document) {
  const language = browserLanguage();
  const response = await fetch(`/locales/${language}.json`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Localization catalog unavailable (${response.status}).`);
  catalog = await response.json();
  root.documentElement.lang = language;
  root.querySelectorAll('[data-i18n]').forEach(element => {
    const translated = t(element.dataset.i18n);
    if (translated) element.textContent = translated;
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const translated = t(element.dataset.i18nAriaLabel);
    if (translated) element.setAttribute('aria-label', translated);
  });
}
