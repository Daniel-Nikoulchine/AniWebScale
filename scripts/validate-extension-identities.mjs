import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const identities = JSON.parse(await readFile(new URL('native/extension-identities.json', root), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));

function chromeIdFromKey(base64Key) {
  const digest = createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest();
  return [...digest.subarray(0, 16)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .replace(/[0-9a-f]/g, character => String.fromCharCode(97 + Number.parseInt(character, 16)));
}

const calculatedChromeId = chromeIdFromKey(manifest.key || '');
if (calculatedChromeId !== identities.chromeExtensionId) {
  throw new Error(`Chrome manifest key produces ${calculatedChromeId}, not ${identities.chromeExtensionId}.`);
}
if (!/^[^\s@]+@[^\s@]+$/.test(identities.firefoxExtensionId)) {
  throw new Error('Firefox extension ID must be an owned email-style ID.');
}
if (!/^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/.test(identities.nativeHostName)) {
  throw new Error('Native host name is invalid.');
}

// Files that must embed the current Firefox extension ID verbatim.
const identityFiles = [
  'native/manifests/native-host-allowlist.json',
  'native/README.md',
];
for (const path of identityFiles) {
  const content = await readFile(new URL(path, root), 'utf8');
  if (!content.includes(identities.firefoxExtensionId)) {
    throw new Error(`${path} does not contain the current Firefox extension ID.`);
  }
}

// webpack.config.js must not hard-code an ID; it has to import the shared
// identity JSON and read firefoxExtensionId from it, so a rotated ID reaches
// the built Firefox manifest.
const webpackConfig = await readFile(new URL('webpack.config.js', root), 'utf8');
if (!/native\/extension-identities\.json/.test(webpackConfig)) {
  throw new Error('webpack.config.js does not import native/extension-identities.json.');
}
if (!/extensionIdentities\.firefoxExtensionId/.test(webpackConfig)) {
  throw new Error('webpack.config.js does not read extensionIdentities.firefoxExtensionId.');
}

console.log(`OK Chrome extension ID ${identities.chromeExtensionId}`);
console.log(`OK Firefox extension ID ${identities.firefoxExtensionId}`);
console.log(`OK Native host ${identities.nativeHostName}`);
