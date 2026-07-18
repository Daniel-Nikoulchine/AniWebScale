import { loadLocalization } from './i18n.mjs';

loadLocalization().catch(error => {
  console.warn('[AniWebScale] Localization could not be loaded:', error);
});
