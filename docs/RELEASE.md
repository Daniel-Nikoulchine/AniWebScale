# Release checklist

## 1. Build the extension

```
npm ci
npm run build:all
```

Both `dist-chrome` and `dist-firefox` must compile. Then verify:

```
npm run lint
npm run typecheck
npm test
npm run check:bundle-sizes
```

Chrome ID: `dlomjcbmgkfaebhplgoihbjfclaagike`
Firefox ID: `aniwebscale@korrespont.com` (from `native/extension-identities.json`).

## 2. Deploy the static website

`website/` is a plain static site. Upload `website/public/` as-is to any static host (Cloudflare Pages, GitHub Pages, Netlify). No API, no server, no database.

```
cd website && npm install && npm start
```

## 3. Store listings

Publish Chrome and Firefox listings. Put their URLs in `website/public/index.html` store-link placeholders (currently `#`).

## 4. Optional Windows renderer

```
npm run build:native
npm run install:native
```