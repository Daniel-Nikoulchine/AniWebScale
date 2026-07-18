import 'dotenv/config';
import { createHash } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { downloadEncryptedBackup } from '../lib/s3-backup-upload.mjs';

const prefix = String(process.env.BACKUP_SECONDARY_S3_PREFIX || 'aniwebscale').replace(/^\/+|\/+$/g, '');
if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(prefix) || prefix.includes('..')) {
  throw new Error('BACKUP_SECONDARY_S3_PREFIX is invalid.');
}
const outputPath = resolve(process.argv[2] || process.env.BACKUP_DOWNLOAD_PATH || '../backups/restore-drill.json.gz.aes');
const storage = {
  endpoint: process.env.BACKUP_SECONDARY_S3_ENDPOINT,
  bucket: process.env.BACKUP_SECONDARY_S3_BUCKET,
  region: process.env.BACKUP_SECONDARY_S3_REGION || 'auto',
  accessKeyId: process.env.BACKUP_SECONDARY_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.BACKUP_SECONDARY_S3_SECRET_ACCESS_KEY,
};

const pointerResult = await downloadEncryptedBackup({
  ...storage,
  key: `${prefix}/latest.json`,
  maximumBytes: 16 * 1024,
});
let pointer;
try {
  pointer = JSON.parse(pointerResult.payload.toString('utf8'));
} catch {
  throw new Error('The secondary backup pointer is not valid JSON.');
}
if (pointer?.version !== 1
  || !Number.isSafeInteger(pointer.bytes)
  || pointer.bytes < 37
  || !/^[a-f0-9]{64}$/.test(pointer.sha256 || '')
  || typeof pointer.objectKey !== 'string'
  || !pointer.objectKey.startsWith(`${prefix}/`)
  || !pointer.objectKey.endsWith('.json.gz.aes')
  || pointer.objectKey.includes('..')) {
  throw new Error('The secondary backup pointer is invalid or outside the configured prefix.');
}

const backup = await downloadEncryptedBackup({
  ...storage,
  key: pointer.objectKey,
  maximumBytes: 1024 * 1024 * 1024,
});
const actualHash = createHash('sha256').update(backup.payload).digest('hex');
if (backup.bytes !== pointer.bytes || actualHash !== pointer.sha256) {
  throw new Error('The downloaded backup does not match the authenticated pointer metadata.');
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, backup.payload, { mode: 0o600 });
await chmod(outputPath, 0o600).catch(() => undefined);
console.log(`SECONDARY BACKUP DOWNLOAD OK ${pointer.objectKey} (${backup.bytes} encrypted bytes)`);
