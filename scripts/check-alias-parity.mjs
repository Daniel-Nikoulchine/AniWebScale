#!/usr/bin/env node
// Alias parity gate: the shared anime4k-webgpu / anime4k-model alias map must
// cover exactly the bundles the generators emit. Mirrors:
//   scripts/prune-anime4k-webgpu.mjs   -> bundles {}
//   scripts/generate-model-shards.mjs  -> names {}
// If a generator gains/loses a bundle, this gate fails until the shared map
// and the loader magic comments are updated together.
import path from 'node:path';
import { GENERATED_ALIASES } from './webpack-aliases.cjs';

const EXPECTED = {
  'anime4k-webgpu/core': 'anime4k-webgpu/core.js',
  'anime4k-webgpu/common': 'anime4k-webgpu/common.js',
  'anime4k-webgpu/quality-m': 'anime4k-webgpu/quality-m.js',
  'anime4k-webgpu/quality-vl': 'anime4k-webgpu/quality-vl.js',
  'anime4k-webgpu/quality-ul': 'anime4k-webgpu/quality-ul.js',
  'anime4k-model/cnn-soft-ul': 'anime4k-models/cnn-soft-ul.js',
  'anime4k-model/denoise-cnn-x2-m': 'anime4k-models/denoise-cnn-x2-m.js',
  'anime4k-model/denoise-cnn-x2-ul': 'anime4k-models/denoise-cnn-x2-ul.js',
  'anime4k-model/artcnn-x2': 'anime4k-models/artcnn-x2.js',
  'anime4k-model/acnet-x2': 'anime4k-models/acnet-x2.js',
  'anime4k-model/arnet-x2': 'anime4k-models/arnet-x2.js',
};

const problems = [];
const actualKeys = Object.keys(GENERATED_ALIASES);
const expectedKeys = Object.keys(EXPECTED);
for (const key of expectedKeys) {
  if (!(key in GENERATED_ALIASES)) problems.push(`alias map is missing ${key}`);
}
for (const key of actualKeys) {
  if (!(key in EXPECTED)) problems.push(`alias map has unexpected ${key}`);
}
const generatedRoot = path.resolve(import.meta.dirname, '..', '.generated');
for (const [key, relative] of Object.entries(EXPECTED)) {
  const target = GENERATED_ALIASES[key];
  if (!target) continue;
  const expectedTarget = path.join(generatedRoot, relative);
  if (target !== expectedTarget) {
    problems.push(`${key} points at ${target}, expected ${expectedTarget}`);
  }
}
if (problems.length > 0) {
  console.error('Alias parity failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`alias parity OK: ${expectedKeys.length} generated aliases match the generator bundle lists`);
