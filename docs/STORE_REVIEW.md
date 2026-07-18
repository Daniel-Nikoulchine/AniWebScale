# Browser store and permission review

## Fixed identities

- Chrome: `dlomjcbmgkfaebhplgoihbjfclaagike` (derived from the committed public manifest key).
- Firefox: `aniwebscale@korrespont.com`.
- Native host: `io.github.anime4k_browser.native`.

`npm run check:identities` verifies the identities before release. After the first real store submission, compare the assigned store IDs again before signing the Native installer.

## Permission justification

| Permission | User-facing purpose |
|---|---|
| `storage` | Save presets, renderer choice, site-specific Native consent and the short-lived signed license locally. |
| `tabs` | Coordinate the active/fullscreen video tab and open the AniWebScale account page. It is not used to build browsing history. |
| `identity` | Open the AniWebScale website sign-in flow and receive a one-time PKCE authorization code without exposing the account password to the extension. |
| `nativeMessaging` | Connect only to the optional locally installed AniWebScale Windows renderer for protected/fullscreen capture. |
| `http://*/*`, `https://*/*` | Find and enhance user-selected video elements across streaming sites. Video frames and visited URLs are not sent to AniWebScale. |

The production manifest declares HTTP(S) origins only as optional host permissions. Users grant one origin at a time from the popup, and the extension registers its content scripts only for granted origins. Store screenshots and copy must explain that processing begins from the extension UI and runs locally. Do not claim Netflix/Prime compatibility as guaranteed; state that DRM may block capture.

Firefox's static validator may label the minified `import(n)` in `content.js` as `UNSAFE_VAR_ASSIGNMENT`. This is Webpack's lazy-chunk loader: `n` is selected only from the compile-time chunk table generated from the fixed Anime4K pipeline imports. Page content, URLs, messages and user data cannot supply a module name or executable source. No `eval`, remote code or user-provided import specifier is used.

## Data disclosure

- Firefox required categories: `authenticationInfo`, `personallyIdentifyingInfo` for account login and license lookup.
- Not collected by AniWebScale: browsing history, website content, video frames, search terms, health/location/communications or payment-card details.
- Stripe-hosted Checkout handles payment data on the website, not inside extension code.
- Privacy policy URL: `https://aniwebscale.pages.dev/privacy` until the confirmed custom domain is active.

## Submission gate

- Build with `npm run build:release:all`; reject `localhost` in output.
- Run unit/type tests, inspect both manifests, scan bundles for secrets and confirm the Native allowlist.
- Provide the privacy URL, permission explanations, data-use answers, support e-mail, screenshots and accurate pricing/refund terms.
- Chrome Web Store and AMO review/signing remain external steps. The Windows Native ZIP should be Authenticode-signed before public distribution; unsigned packages can trigger SmartScreen.
