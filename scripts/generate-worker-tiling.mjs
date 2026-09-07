#!/usr/bin/env node
/**
 * Mirror canonical zero-import shared modules into the inference worker.
 *
 * The worker stays import-free for the Blob-URL load, so it cannot import
 * src/shared/*.js. This script copies the marked regions of the canonical
 * sources verbatim into src/worker/realesrgan-inference-worker.js between
 * the matching `<generated-*>` markers. Single source of truth stays the
 * shared module; the worker copy is build output with a header saying so.
 *
 * Mirrored blocks:
 *   - realesrgan-tile-geometry.js      -> <generated-tile-geometry>
 *   - realesrgan-ort-shape-pinning.js  -> <generated-ort-shape-pinning>
 *
 * Usage:
 *   node scripts/generate-worker-tiling.mjs [--check] [--force]
 *   --check  fail when any worker copy drifts from its canonical source
 *   --force  rewrite the worker copies even when they look fresh
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKER = join(repoRoot, 'src', 'worker', 'realesrgan-inference-worker.js');

const BLOCKS = [
  {
    name: 'tile geometry',
    source: join(repoRoot, 'src', 'shared', 'realesrgan-tile-geometry.js'),
    srcBegin: '// <tile-geometry-begin>',
    srcEnd: '// <tile-geometry-end>',
    genBegin: '// <generated-tile-geometry>',
    genEnd: '// </generated-tile-geometry>',
  },
  {
    name: 'ort shape pinning',
    source: join(repoRoot, 'src', 'shared', 'realesrgan-ort-shape-pinning.js'),
    srcBegin: '// <ort-shape-pinning-begin>',
    srcEnd: '// <ort-shape-pinning-end>',
    genBegin: '// <generated-ort-shape-pinning>',
    genEnd: '// </generated-ort-shape-pinning>',
  },
];

function extractMarked(text, begin, end, label) {
  const start = text.indexOf(begin);
  const stop = text.indexOf(end);
  if (start === -1 || stop === -1 || stop < start) {
    throw new Error(`generate-worker-tiling: markers missing in ${label}`);
  }
  return text.slice(start + begin.length, stop);
}

function buildGeneratedInner(block) {
  const source = readFileSync(block.source, 'utf8');
  const body = extractMarked(source, block.srcBegin, block.srcEnd, block.source);
  return [
    `// GENERATED from ${block.source.replace(repoRoot + '/', '')} — do not edit.`,
    '// Run `node scripts/generate-worker-tiling.mjs` after changing the source.',
    body.replace(/^\n/, '').replace(/\s+$/, ''),
  ].join('\n');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const worker = readFileSync(WORKER, 'utf8');
  let next = worker;
  let drifted = false;
  for (const block of BLOCKS) {
    const wantedInner = buildGeneratedInner(block);
    const wanted = [block.genBegin, wantedInner, block.genEnd].join('\n');
    let current;
    try {
      current = extractMarked(worker, block.genBegin, block.genEnd, `worker file (${block.name})`);
    } catch {
      current = null;
    }
    const fresh = current !== null && current.trim() === wantedInner.trim();
    if (args.has('--check')) {
      if (!fresh) {
        console.error(`generate-worker-tiling: worker copy of ${block.name} drifts from ${block.source} (run without --check to refresh)`);
        drifted = true;
      } else {
        console.log(`generate-worker-tiling: worker copy of ${block.name} matches the canonical source.`);
      }
      continue;
    }
    if (fresh && !args.has('--force')) {
      console.log(`generate-worker-tiling: worker copy of ${block.name} is fresh, nothing to do.`);
      continue;
    }
    if (current === null) {
      throw new Error(`generate-worker-tiling: generation markers missing in worker file (${block.name})`);
    }
    const start = next.indexOf(block.genBegin);
    const stop = next.indexOf(block.genEnd);
    next = next.slice(0, start) + wanted + next.slice(stop + block.genEnd.length);
    console.log(`generate-worker-tiling: worker copy of ${block.name} refreshed.`);
  }
  if (args.has('--check')) {
    if (drifted) process.exit(1);
    return;
  }
  writeFileSync(WORKER, next);
}

await main();
