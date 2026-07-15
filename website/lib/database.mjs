import pg from 'pg';

const { Pool } = pg;

export function createDatabase(connectionString = process.env.DATABASE_URL || '') {
  const pool = connectionString
    ? new Pool({
        connectionString,
        max: 4,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        application_name: 'aniwebscale-website',
      })
    : null;

  return {
    configured: Boolean(pool),

    async query(text, values = []) {
      if (!pool) throw new Error('DATABASE_NOT_CONFIGURED');
      return pool.query(text, values);
    },

    async transaction(callback) {
      if (!pool) throw new Error('DATABASE_NOT_CONFIGURED');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback((text, values = []) => client.query(text, values));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      if (pool) await pool.end();
    },
  };
}
