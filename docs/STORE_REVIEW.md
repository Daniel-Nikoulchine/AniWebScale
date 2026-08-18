# Store review

## Fixed identities

- Chrome: `dlomjcbmgkfaebhplgoihbjfclaagike` (derived from the committed public manifest key).
- Firefox: `aniwebscale@korrespont.com`.
- Native host: `io.github.anime4k_browser.native`.

`npm run check:identities` verifies them before release.

## Permission justification

| Permission | Purpose |
|---|---|
| `storage` | Save presets, renderer choice, site consent locally. |
| `activeTab` | Coordinate enhancement with the tab the user invokes from the extension UI. |
| `scripting` | Register content scripts only after the user grants a site origin; remove them on revoke. |
| `nativeMessaging` | Connect to the optional locally installed Windows renderer. |
| `http://*/*`, `https://*/*` | Find and enhance video elements across streaming sites. |

Origins are optional host permissions: users grant one origin at a time from the popup. Store screenshots must explain that processing starts from the extension UI and runs locally.

## Data disclosure

- Firefox required categories: none. AniWebScale collects no personal data.
- Privacy policy URL: `https://aniwebscale.pages.dev/privacy`.

## Submission gate

- `npm run build:all` - reject `localhost` in output.
- Run unit/type tests, inspect both manifests, scan bundles for secrets.
- Provide privacy URL, permission explanations, screenshots, support e-mail.