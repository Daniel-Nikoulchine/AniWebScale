import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARCHIVE_TABLES,
  DISCARD_ON_RESTORE_TABLES,
  decryptDatabaseArchive,
  encryptDatabaseArchive,
  validateDatabaseArchive,
} from '../lib/database-archive.mjs';

function fixture() {
  return {
    format: 'aniwebscale-postgres-backup',
    version: 2,
    createdAt: '2026-07-17T10:00:00.000Z',
    tables: Object.fromEntries(ARCHIVE_TABLES.map(({ schema, table }) => [
      `${schema}.${table}`,
      { columns: ['id'], rows: [] },
    ])),
  };
}

describe('encrypted database archives', () => {
  it('never restores authentication credentials or rate-limit windows', () => {
    assert.deepEqual([...DISCARD_ON_RESTORE_TABLES], [
      'neon_auth.session',
      'neon_auth.verification',
      'app.extension_auth_codes',
      'app.extension_sessions',
      'app.auth_rate_limits',
    ]);
  });

  it('round-trips every required auth and application table', async () => {
    const key = Buffer.alloc(32, 9);
    const document = fixture();
    const payload = await encryptDatabaseArchive(document, key);
    assert.deepEqual(await decryptDatabaseArchive(payload, key), document);
  });

  it('rejects tampering before exposing archive contents', async () => {
    const key = Buffer.alloc(32, 4);
    const payload = await encryptDatabaseArchive(fixture(), key);
    payload[payload.length - 1] ^= 1;
    await assert.rejects(() => decryptDatabaseArchive(payload, key));
  });

  it('rejects incomplete restore archives', () => {
    const document = fixture();
    delete document.tables['neon_auth.user'];
    assert.throws(() => validateDatabaseArchive(document), /missing neon_auth\.user/);
  });
});
