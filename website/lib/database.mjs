import pg from 'pg';

const { Client } = pg;

export function createDatabase(
  connectionString = process.env.DATABASE_URL || '',
  ClientClass = Client,
) {
  const configured = Boolean(connectionString);

  async function withClient(callback) {
    if (!configured) throw new Error('DATABASE_NOT_CONFIGURED');
    const client = new ClientClass({
      connectionString,
      connectionTimeoutMillis: 10_000,
      application_name: 'aniwebscale-website',
    });
    await client.connect();
    try {
      return await callback(client);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  return {
    configured,

    async query(text, values = []) {
      return withClient(client => client.query(text, values));
    },

    async transaction(callback) {
      return withClient(async client => {
        await client.query('BEGIN');
        try {
          const result = await callback((text, values = []) => client.query(text, values));
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw error;
        }
      });
    },

    async close() {},
  };
}
