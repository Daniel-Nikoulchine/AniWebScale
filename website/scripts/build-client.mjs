import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await build({
  entryPoints: ['client/account.mjs'],
  outfile: 'public/account.js',
  bundle: true,
  minify: true,
  sourcemap: false,
  platform: 'browser',
  format: 'iife',
  target: ['chrome120', 'firefox121', 'safari17'],
  legalComments: 'none',
});

await build({
  entryPoints: ['client/site-localize.mjs'],
  outfile: 'public/site-localize.js',
  bundle: true,
  minify: true,
  sourcemap: false,
  platform: 'browser',
  format: 'iife',
  target: ['chrome120', 'firefox121', 'safari17'],
  legalComments: 'none',
});

await mkdir('public/vendor/lucide', { recursive: true });
await mkdir('public/locales', { recursive: true });
await Promise.all([
  copyFile('node_modules/lucide-static/font/lucide.css', 'public/vendor/lucide/lucide.css'),
  copyFile('node_modules/lucide-static/font/lucide.woff2', 'public/vendor/lucide/lucide.woff2'),
  copyFile('../public/_locales/en/messages.json', 'public/locales/en.json'),
  copyFile('../public/_locales/de/messages.json', 'public/locales/de.json'),
]);
