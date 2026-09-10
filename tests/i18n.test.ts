import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readRepo(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function messages(locale: string): Record<string, { message: string }> {
  return JSON.parse(readRepo(`public/_locales/${locale}/messages.json`));
}

describe('extension localization catalog', () => {
  it('keeps German and English message keys complete and non-empty', () => {
    const english = messages('en');
    const german = messages('de');
    expect(Object.keys(german).sort()).toEqual(Object.keys(english).sort());
    expect(Object.values(english).every(({ message }) => message.trim().length > 0)).toBe(true);
    expect(Object.values(german).every(({ message }) => message.trim().length > 0)).toBe(true);
  });

  it('localizes the manifest identity through the same catalog', () => {
    const manifest = JSON.parse(readRepo('manifest.json'));
    expect(manifest.default_locale).toBe('en');
    expect(manifest.name).toBe('__MSG_extensionName__');
    expect(manifest.description).toBe('__MSG_description__');
  });

  it('publishes the extension catalog as a subset of the website catalog', () => {
    for (const locale of ['en', 'de']) {
      const website = JSON.parse(readRepo(`website/public/locales/${locale}.json`));
      const extension = messages(locale);
      // Every extension key must exist on the website with the identical value;
      // the website may carry additional marketing/legal-only keys on top.
      for (const [key, value] of Object.entries(extension)) {
        expect(website[key], `website locale "${locale}" is missing extension key "${key}"`).toEqual(value);
      }
    }
  });

  it('keeps the website German and English catalogs in key parity', () => {
    const english = Object.keys(JSON.parse(readRepo('website/public/locales/en.json'))).sort();
    const german = Object.keys(JSON.parse(readRepo('website/public/locales/de.json'))).sort();
    expect(german).toEqual(english);
  });
});

describe('user-selected UI language', () => {
  type StorageValue = Record<string, { message?: string } | string | undefined>;

  const storage: { data: StorageValue; browserLanguage: string } = {
    data: {},
    browserLanguage: 'en',
  };

  function reimportModule() {
    vi.resetModules();
    return import('../src/ui/i18n');
  }

  beforeEach(() => {
    storage.data = {};
    storage.browserLanguage = 'en';
    vi.stubGlobal('chrome', {
      i18n: { getUILanguage: () => storage.browserLanguage },
      storage: {
        local: {
          get: vi.fn(async (keys: string[]) => {
            const out: Record<string, unknown> = {};
            for (const key of keys) if (key in storage.data) out[key] = storage.data[key];
            return out;
          }),
          set: vi.fn(async (values: StorageValue) => {
            Object.assign(storage.data, values);
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('follows the browser UI language when set to auto', async () => {
    storage.browserLanguage = 'de';
    const { initI18n, getUiLanguage, message } = await reimportModule();
    await initI18n();
    expect(getUiLanguage()).toBe('auto');
    expect(message('theme')).toBe('Design');
  });

  it('uses the explicitly selected catalog over the browser language', async () => {
    storage.browserLanguage = 'en';
    storage.data.uiLanguage = 'de';
    const { initI18n, message, getUiLanguage } = await reimportModule();
    await initI18n();
    expect(getUiLanguage()).toBe('de');
    expect(message('theme')).toBe('Design');
  });

  it('switches the catalog immediately without a reload', async () => {
    storage.browserLanguage = 'de';
    const { initI18n, setUiLanguage, message } = await reimportModule();
    await initI18n();
    await setUiLanguage('en');
    expect(message('theme')).toBe('Theme');
    expect(storage.data.uiLanguage).toBe('en');
  });

  it('keeps the shared chrome.i18n fallback for keys only the engine knows', async () => {
    storage.browserLanguage = 'en';
    const { initI18n, message } = await reimportModule();
    await initI18n();
    // Not a catalog key (extensions provide it at runtime) — envelope fallback.
    expect(message('totallyMissingKey', 'fallback')).toBe('fallback');
  });
});
