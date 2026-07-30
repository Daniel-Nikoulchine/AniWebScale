import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function messages(locale: string): Record<string, { message: string }> {
  return JSON.parse(readFileSync(`public/_locales/${locale}/messages.json`, 'utf8'));
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
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    expect(manifest.default_locale).toBe('en');
    expect(manifest.name).toBe('__MSG_extensionName__');
    expect(manifest.description).toBe('__MSG_description__');
  });

  it('publishes the extension catalog as a subset of the website catalog', () => {
    for (const locale of ['en', 'de']) {
      const website = JSON.parse(readFileSync(`website/public/locales/${locale}.json`, 'utf8'));
      const extension = messages(locale);
      // Every extension key must exist on the website with the identical value;
      // the website may carry additional marketing/legal-only keys on top.
      for (const [key, value] of Object.entries(extension)) {
        expect(website[key], `website locale "${locale}" is missing extension key "${key}"`).toEqual(value);
      }
    }
  });
});
