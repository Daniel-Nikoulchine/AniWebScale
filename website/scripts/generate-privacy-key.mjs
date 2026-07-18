import { randomBytes } from 'node:crypto';

console.log(`PRIVACY_HASH_KEY_B64=${randomBytes(32).toString('base64')}`);
