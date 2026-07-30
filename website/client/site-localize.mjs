import { loadLocalization, setLanguage } from './i18n.mjs';

loadLocalization().then(() => {
  document.querySelectorAll('[data-lang-toggle]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.langToggle));
  });
}).catch(error => {
  console.warn('[AniWebScale] Localization could not be loaded:', error);
});
