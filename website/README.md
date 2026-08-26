AniWebScale is a fully free static marketing site for the AniWebScale browser extension. It has no backend, no API, no database, and no account system.

## Pages

- `index.html` — Landing page with features, FAQ, download links
- `privacy.html`, `support.html`, `imprint.html`, `terms.html` — Legal and contact pages
- `404.html` — Custom error page

## Local setup

```bash
cd website
npm install
npm start
```

Opens `http://localhost:4242` with the static site. Requires no configuration, environment variables, or third-party services.

## i18n

Source files are in `client/`:

- `client/i18n.mjs` — Translation helper (reads `lang` from URL/search/locale, falls back to `en`)
- `client/site-localize.mjs` — Applies translations to the DOM

Build with:

```bash
npm run build:client
```

## Deployment

Upload `public/` as-is to any static host. The site is configured for Cloudflare Pages (wrangler is in `devDependencies`) but works with any static host.

```bash
npx wrangler pages deploy public
```
