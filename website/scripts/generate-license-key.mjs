import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const base64 = Buffer.from(pem).toString('base64');

console.log('# Keep this value secret and stable across server restarts.');
console.log(`LICENSE_PRIVATE_KEY_PKCS8_B64=${base64}`);
