import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  decodeArchiveKey,
  decryptDatabaseArchive,
} from '../lib/database-archive.mjs';

async function backupPath() {
  if (process.argv[2]) return resolve(process.argv[2]);
  const directory = resolve(process.env.BACKUP_OUTPUT_DIR || '../backups');
  const candidates = (await readdir(directory))
    .filter(name => /^aniwebscale-.*\.json\.gz\.aes$/.test(name))
    .sort()
    .reverse();
  if (!candidates[0]) throw new Error(`No encrypted backups found in ${directory}.`);
  return resolve(directory, candidates[0]);
}

const path = await backupPath();
const document = await decryptDatabaseArchive(
  await readFile(path),
  decodeArchiveKey(process.env.BACKUP_ENCRYPTION_KEY_B64),
);
const rowCount = Object.values(document.tables).reduce((sum, table) => sum + table.rows.length, 0);
console.log(`VERIFY OK ${path} (${document.createdAt}, ${rowCount} rows, format v${document.version})`);
