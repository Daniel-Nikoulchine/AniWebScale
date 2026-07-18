import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createDatabase } from '../lib/database.mjs';

class FakeClient {
  static instances = [];

  constructor(config) {
    this.config = config;
    this.queries = [];
    this.connected = false;
    this.ended = false;
    FakeClient.instances.push(this);
  }

  async connect() {
    this.connected = true;
  }

  async query(text, values = []) {
    this.queries.push({ text, values });
    if (text === 'FAIL') throw new Error('query failed');
    return { rows: [{ ok: true }] };
  }

  async end() {
    this.ended = true;
  }
}

describe('database client lifecycle', () => {
  beforeEach(() => {
    FakeClient.instances = [];
  });

  it('creates and closes a fresh client for every standalone query', async () => {
    const database = createDatabase('postgresql://example.invalid/neondb', FakeClient);

    await database.query('SELECT $1::int', [1]);
    await database.query('SELECT $1::int', [2]);

    assert.equal(FakeClient.instances.length, 2);
    for (const client of FakeClient.instances) {
      assert.equal(client.connected, true);
      assert.equal(client.ended, true);
      assert.equal(client.queries.length, 1);
    }
  });

  it('keeps one client for a transaction and closes it after commit', async () => {
    const database = createDatabase('postgresql://example.invalid/neondb', FakeClient);

    await database.transaction(async query => {
      await query('SELECT 1');
      await query('UPDATE app.entitlements SET status = $1', ['active']);
    });

    assert.equal(FakeClient.instances.length, 1);
    assert.deepEqual(
      FakeClient.instances[0].queries.map(query => query.text),
      ['BEGIN', 'SELECT 1', 'UPDATE app.entitlements SET status = $1', 'COMMIT'],
    );
    assert.equal(FakeClient.instances[0].ended, true);
  });

  it('rolls back and closes the transaction client after a query failure', async () => {
    const database = createDatabase('postgresql://example.invalid/neondb', FakeClient);

    await assert.rejects(
      database.transaction(async query => query('FAIL')),
      /query failed/,
    );

    assert.deepEqual(
      FakeClient.instances[0].queries.map(query => query.text),
      ['BEGIN', 'FAIL', 'ROLLBACK'],
    );
    assert.equal(FakeClient.instances[0].ended, true);
  });
});
