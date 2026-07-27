import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';

const FREE_COMPRESSED_LIMIT = 3 * 1024 * 1024;
const output = '.wrangler/functions-build/index.js';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await run(process.execPath, ['scripts/build-client.mjs']);
await run(process.execPath, [
  resolve('node_modules/wrangler/bin/wrangler.js'),
  'pages',
  'functions',
  'build',
  '--outdir=.wrangler/functions-build',
  '--minify',
  '--metafile',
  '--compatibility-date=2026-07-15',
  '--compatibility-flags=nodejs_compat',
]);
const { size } = await stat(output);
let compressedSize = 0;
await pipeline(
  createReadStream(output),
  createGzip({ level: 9 }),
  new Writable({
    write(chunk, encoding, callback) {
      compressedSize += chunk.length;
      callback();
    },
  }),
);
if (compressedSize > FREE_COMPRESSED_LIMIT) {
  throw new Error(
    `Cloudflare Function bundle is ${compressedSize} compressed bytes, over the 3 MiB Workers Free limit.`,
  );
}
console.log(
  `Cloudflare Function bundle: ${size} raw / ${compressedSize} gzip bytes (3 MiB Workers Free gate passed).`,
);
