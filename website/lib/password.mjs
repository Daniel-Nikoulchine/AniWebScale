import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

const SCRYPT_OPTIONS = Object.freeze({
  N: 16_384,
  r: 16,
  p: 1,
  maxmem: 128 * 16_384 * 16 * 2,
});

function derivePasswordKey(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      SCRYPT_OPTIONS,
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derivePasswordKey(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') return false;
  const match = /^([0-9a-f]{32}):([0-9a-f]{128})$/i.exec(encodedHash);
  if (!match) return false;
  const actual = await derivePasswordKey(password, match[1]);
  const expected = Buffer.from(match[2], 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
