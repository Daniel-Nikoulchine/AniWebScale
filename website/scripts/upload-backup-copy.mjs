import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import pg from 'pg';
import { recordOperationalResult } from '../lib/operational-status.mjs';
import { uploadEncryptedBackup } from '../lib/s3-backup-upload.mjs';

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '')) {
  throw new Error('DATABASE_URL is missing or invalid.');
}
const outputDirectory = resolve(process.env.BACKUP_OUTPUT_DIR || '../backups');
const candidates = (await readdir(outputDirectory)).filter(name => name.endsWith('.json.gz.aes'));
if (candidates.length !== 1) {
  throw new Error(`Expected exactly one encrypted backup in ${outputDirectory}; found ${candidates.length}.`);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'aniwebscale-secondary-backup',
  connectionTimeoutMillis: 10_000,
});
await client.connect();
const startedAt = Date.now();
try {
  const filename = basename(candidates[0]);
  const prefix = String(process.env.BACKUP_SECONDARY_S3_PREFIX || 'aniwebscale').replace(/^\/+|\/+$/g, '');
  const payload = await readFile(resolve(outputDirectory, filename));
  const storage = {
    endpoint: process.env.BACKUP_SECONDARY_S3_ENDPOINT,
    bucket: process.env.BACKUP_SECONDARY_S3_BUCKET,
    region: process.env.BACKUP_SECONDARY_S3_REGION || 'auto',
    accessKeyId: process.env.BACKUP_SECONDARY_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.BACKUP_SECONDARY_S3_SECRET_ACCESS_KEY,
  };
  const result = await uploadEncryptedBackup({
    ...storage,
    key: `${prefix}/${filename}`,
    payload,
  });
  const pointer = Buffer.from(`${JSON.stringify({
    version: 1,
    objectKey: result.objectKey,
    bytes: result.bytes,
    sha256: createHash('sha256').update(payload).digest('hex'),
  })}\n`, 'utf8');
  await uploadEncryptedBackup({
    ...storage,
    key: `${prefix}/latest.json`,
    payload: pointer,
  });
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'database_backup_secondary',
    success: true,
    durationMs: Date.now() - startedAt,
  });
  console.log(`SECONDARY BACKUP OK ${result.objectKey} (${result.bytes} encrypted bytes; latest pointer updated)`);
} catch (error) {
  await recordOperationalResult((sql, values) => client.query(sql, values), {
    jobName: 'database_backup_secondary',
    success: false,
    durationMs: Date.now() - startedAt,
  }).catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
