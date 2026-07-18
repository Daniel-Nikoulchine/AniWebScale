export function message(
  key: string,
  fallback = '',
  replacements: Record<string, string | number> = {},
): string {
  const value = typeof chrome !== 'undefined' && chrome.i18n?.getMessage
    ? chrome.i18n.getMessage(key)
    : '';
  return Object.entries(replacements).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    value || fallback,
  );
}

export function localizeDocument(root: Document = document): void {
  const language = chrome.i18n.getUILanguage().split('-', 1)[0] || 'en';
  root.documentElement.lang = language;
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
