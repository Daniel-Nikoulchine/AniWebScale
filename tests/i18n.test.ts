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

  it('publishes the same catalogs for website and legal navigation', () => {
    for (const locale of ['en', 'de']) {
      expect(JSON.parse(readFileSync(`website/public/locales/${locale}.json`, 'utf8')))
        .toEqual(messages(locale));
    }
  });
});
