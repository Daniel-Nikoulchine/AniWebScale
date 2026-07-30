# Release checklist

AniWebScale is fully free. There is no account, no license server, no database and
no payment backend. The extension bundles every feature locally, and the website
is a static marketing site. This shortens the release to an extension build plus a
static site deploy.

## 1. Build the extension

```powershell
npm ci
npm run build:all
```

Both `dist-chrome` and `dist-firefox` must compile. Verify the budget and signatures
are not regressed:

```powershell
npm run lint
npm run typecheck
npm test
npm run check:bundle-sizes
```

The fixed unpacked Chrome ID is `dlomjcbmgkfaebhplgoihbjfclaagike`; the Firefox ID is
`aniwebscale@korrespont.com`, both verified from `native/extension-identities.json`.

## 2. Deploy the static website

The `website/` folder is a plain static site. Build output lives in `website/public/`
and can be served by any static host (Cloudflare Pages, GitHub Pages, Netlify, …).

```powershell
cd website
npm install
npm start        # serves website/public locally for a smoke test
```

Upload `website/public/` as-is. There is no API, no server function, no database
migration and no webhook to configure.

## 3. Store listings

- Publish the Chrome and Firefox listings and put their exact URLs in the website
  `index.html` store-link placeholders (currently `#`).
- No paid plan, no legal/tax/data-protection approval gates, no Stripe webhook, no
  Neon Auth configuration and no license verification are required.

## 4. Optional Windows renderer

The native Windows renderer remains an optional local component. Build and install
it from the repository:

```powershell
npm run build:native
npm run install:native
```

No signing infrastructure, store secrets or account API URL are needed for a local
build.
