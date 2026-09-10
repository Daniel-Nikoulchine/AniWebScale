#!/usr/bin/env node
// Bidirectional en/de locale key-parity gate for the marketing site.
// Fails when a catalog key exists in one language but not the other, or when a
// value is not a { message: string } entry. Run via `npm run check:locales`.
import { readFileSync } from 'node:fs';

const locales = ['en', 'de'];
const catalogs = Object.fromEntries(locales.map(locale => {
  const url = new URL(`../public/locales/${locale}.json`, import.meta.url);
  return [locale, JSON.parse(readFileSync(url, 'utf8'))];
}));

const problems = [];
for (const locale of locales) {
  const catalog = catalogs[locale];
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    problems.push(`${locale}.json is not a flat object catalog`);
    continue;
  }
  for (const [key, entry] of Object.entries(catalog)) {
    if (!entry || typeof entry.message !== 'string') {
      problems.push(`${locale}.json: ${key} is missing a string message`);
    }
  }
}

const [reference, ...rest] = locales;
const referenceKeys = new Set(Object.keys(catalogs[reference] ?? {}));
for (const locale of rest) {
  const keys = new Set(Object.keys(catalogs[locale] ?? {}));
  const missing = [...referenceKeys].filter(key => !keys.has(key));
  const extra = [...keys].filter(key => !referenceKeys.has(key));
  if (missing.length > 0) problems.push(`${locale}.json is missing keys: ${missing.join(', ')}`);
  if (extra.length > 0) problems.push(`${locale}.json has keys absent from ${reference}.json: ${extra.join(', ')}`);
}

if (problems.length > 0) {
  console.error('Locale parity failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`locale parity OK: ${referenceKeys.size} keys aligned across ${locales.join(', ')}`);
