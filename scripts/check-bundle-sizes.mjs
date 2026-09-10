import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { REQUIRED_LAZY_CHUNKS } from './chunk-names.mjs';

const MAX_LAZY_CHUNK_BYTES = 750 * 1024;

const buildDirectories = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['dist-chrome', 'dist-firefox'];

for (const buildDirectory of buildDirectories) {
  const chunkDirectory = path.resolve(buildDirectory, 'chunks');
  const files = await readdir(chunkDirectory);
  for (const required of REQUIRED_LAZY_CHUNKS) {
    if (!files.includes(required)) {
      throw new Error(`${buildDirectory}: expected lazy renderer chunk ${required} is missing.`);
    }
  }

  let largest = { name: '', size: 0 };
  for (const filename of files.filter(candidate => candidate.endsWith('.js'))) {
    const { size } = await stat(path.join(chunkDirectory, filename));
    if (size > largest.size) largest = { name: filename, size };
    if (size > MAX_LAZY_CHUNK_BYTES) {
      throw new Error(
        `${buildDirectory}: ${filename} is ${size} bytes; lazy chunks are limited to ${MAX_LAZY_CHUNK_BYTES}.`,
      );
    }
  }
  console.log(`${buildDirectory}: largest lazy chunk ${largest.name} is ${largest.size} bytes (budget passed).`);
}
