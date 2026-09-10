AniWebScale is a fully free static marketing site for the AniWebScale browser extension. It has no backend, no API, no database, no account system and no payment integration.

## Pages

- `index.html` — Landing page with features, FAQ, download links
- `privacy.html`, `support.html`, `imprint.html`, `terms.html` — Legal and contact pages
- `404.html` — Custom error page

## Local setup

```bash
cd website
npm ci
npm start
```

Opens `http://localhost:4242` with the static site. Requires no configuration, environment variables or third-party services.

## i18n

Source files are in `client/`:

- `client/i18n.mjs` — Translation helper (reads `lang` from URL/search/locale, falls back to `en`)
- `client/site-localize.mjs` — Applies translations to the DOM and exposes the catalog lookup for `app.js`

`public/site-localize.js` is a generated bundle and is committed so the site can be
deployed as-is. Rebuild and verify it with:

```bash
npm run build:client
git diff --exit-code public/site-localize.js   # CI drift gate
npm run check:locales                          # bidirectional en/de key parity
```

## Deployment

Run `npm run build:client` first, then upload `public/` as-is to any static host
(for example `npx --yes wrangler pages deploy public`). The site is committed to
Cloudflare Pages but works with any static host.
