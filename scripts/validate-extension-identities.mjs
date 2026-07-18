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

const identityFiles = [
  'webpack.config.js',
  'native/manifests/native-host-allowlist.json',
  'native/README.md',
];
for (const path of identityFiles) {
  const content = await readFile(new URL(path, root), 'utf8');
  if (path !== 'webpack.config.js' && !content.includes(identities.firefoxExtensionId)) {
    throw new Error(`${path} does not contain the current Firefox extension ID.`);
  }
}

console.log(`OK Chrome extension ID ${identities.chromeExtensionId}`);
console.log(`OK Firefox extension ID ${identities.firefoxExtensionId}`);
console.log(`OK Native host ${identities.nativeHostName}`);
