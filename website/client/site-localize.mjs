import { loadLocalization, setLanguage, t } from './i18n.mjs';

loadLocalization().then(() => {
  // Expose the catalog lookup to the non-module app.js (theme labels, toasts)
  // and announce readiness so dynamic labels can be re-applied.
  window.aniwebscaleT = t;
  window.dispatchEvent(new CustomEvent('aniwebscale:localized'));
  document.querySelectorAll('[data-lang-toggle]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.langToggle));
  });
}).catch(error => {
  console.warn('[AniWebScale] Localization could not be loaded:', error);
});
