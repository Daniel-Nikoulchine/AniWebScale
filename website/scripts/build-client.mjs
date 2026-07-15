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

await mkdir('public/vendor/lucide', { recursive: true });
await Promise.all([
  copyFile('node_modules/lucide-static/font/lucide.css', 'public/vendor/lucide/lucide.css'),
  copyFile('node_modules/lucide-static/font/lucide.woff2', 'public/vendor/lucide/lucide.woff2'),
]);
