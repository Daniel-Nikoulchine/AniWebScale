import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadMigrations, applyMigrations } from '../lib/migrations.mjs';
import { EXPECTED_SCHEMA_VERSION } from '../lib/schema-version.mjs';

const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

function fakeClient(rows = []) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql: String(sql).trim(), values });
      if (String(sql).includes('SELECT version, name, checksum')) return { rows };
      return { rows: [], rowCount: 1 };
    },
  };
}

describe('versioned database migrations', () => {
  it('loads unique, ordered and checksummed migration files', async () => {
    const migrations = await loadMigrations(migrationDirectory);
    assert.deepEqual(migrations.map(item => item.version), ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009']);
    assert.equal(migrations.at(-1).version, EXPECTED_SCHEMA_VERSION);
    assert.ok(migrations.every(item => /^[a-f0-9]{64}$/.test(item.checksum)));
    assert.match(migrations[0].sql, /CREATE TABLE IF NOT EXISTS app\.entitlements/);
  });

  it('applies every pending migration in one transaction', async () => {
    const client = fakeClient();
    const migrations = await loadMigrations(migrationDirectory);
    const result = await applyMigrations(client, migrations);
    assert.deepEqual(result.applied, migrations.map(item => item.name));
    assert.deepEqual(result.skipped, []);
    assert.equal(client.calls[0].sql, 'BEGIN');
    assert.equal(client.calls.at(-1).sql, 'COMMIT');
    assert.equal(client.calls.filter(call => call.sql.startsWith('INSERT INTO app.schema_migrations')).length, 9);
  });

  it('refuses a changed migration that was already recorded', async () => {
    const migrations = await loadMigrations(migrationDirectory);
    const client = fakeClient([{
      version: migrations[0].version,
      name: migrations[0].name,
      checksum: '0'.repeat(64),
    }]);
    await assert.rejects(() => applyMigrations(client, migrations), /does not match/);
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  });
});
