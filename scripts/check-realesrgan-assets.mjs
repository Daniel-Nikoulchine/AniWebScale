#!/usr/bin/env node
/**
 * Coverage gate for the RealESRGAN asset registry.
 *
 * Asserts that every asset named in src/shared/realesrgan-assets.json is
 * actually shippable: source files exist, static variant names follow the
 * builder rule, and the webpack copy rules + manifest
 * web_accessible_resources cover them. Add an asset to the registry and
 * this gate tells you every place that must learn about it.
 *
 * Usage: node scripts/check-realesrgan-assets.mjs (exit non-zero on drift)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`check-realesrgan-assets: FAIL ${message}`);
};

const registry = JSON.parse(
  readFileSync(join(repoRoot, 'src', 'shared', 'realesrgan-assets.json'), 'utf8'),
);

// 1. Schema: the three class maps plus a valid static shape list.
for (const key of ['classToModelFile', 'classToFp16ModelFile', 'classToInt8ModelFile']) {
  if (!registry[key] || typeof registry[key] !== 'object') fail(`registry misses object "${key}"`);
}
if (!Array.isArray(registry.staticShapes) || registry.staticShapes.length === 0) {
  fail('registry staticShapes must be a non-empty array');
}
const staticFileName = (height, width) => `RealESR-AnimeVideo-v3_x4.static-${height}x${width}.onnx`;
for (const shape of registry.staticShapes ?? []) {
  if (!Number.isInteger(shape.width) || !Number.isInteger(shape.height) || typeof shape.file !== 'string') {
    fail(`static shape is not {width, height, file}: ${JSON.stringify(shape)}`);
    continue;
  }
  if (shape.file !== staticFileName(shape.height, shape.width)) {
    fail(`static shape file breaks the builder rule: ${shape.file}`);
  }
}

// 2. Source assets exist (static variants are git-ignored build outputs:
// their names are pinned by rule above, not by existence here).
const modelDir = join(repoRoot, 'models', 'realesrgan');
const sourceFiles = new Set([
  ...Object.values(registry.classToModelFile ?? {}),
  ...Object.values(registry.classToFp16ModelFile ?? {}),
  ...Object.values(registry.classToInt8ModelFile ?? {}),
]);
for (const file of sourceFiles) {
  if (!existsSync(join(modelDir, file))) fail(`source asset missing: models/realesrgan/${file}`);
}

// 3. Manifest web_accessible_resources covers the model + chunk globs.
const manifest = JSON.parse(readFileSync(join(repoRoot, 'manifest.json'), 'utf8'));
const warResources = (manifest.web_accessible_resources ?? []).flatMap(entry => entry.resources ?? []);
for (const pattern of ['models/realesrgan/*', 'chunks/*.js', 'chunks/*.wasm', 'ort/*']) {
  if (!warResources.includes(pattern)) fail(`manifest web_accessible_resources misses "${pattern}"`);
}

// 4. Webpack copy rules ship the registry scope (models dir, worker
// chunks, pixels wasm, optional fp16). Structural read of the plugin
// config; falls back to a config text scan when webpack cannot load.
let copyPatterns;
try {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const configFactory = require(join(repoRoot, 'webpack.config.js'));
  const config = configFactory({}, { mode: 'production' });
  const plugins = Array.isArray(config) ? config.flatMap(c => c.plugins ?? []) : (config.plugins ?? []);
  const copyPlugin = plugins.find(p => p && p.constructor && /copy/i.test(p.constructor.name));
  copyPatterns = copyPlugin?.patterns?.map(p => p.from).filter(v => typeof v === 'string') ?? [];
} catch {
  const text = readFileSync(join(repoRoot, 'webpack.config.js'), 'utf8');
  const found = [...text.matchAll(/from:\s*'([^']+)'/g)].map(m => m[1]);
  copyPatterns = found;
}
for (const from of ['models', 'src/worker/*.js', 'wasm/pixels.wasm', 'models/realesrgan/*.fp16.onnx']) {
  if (!copyPatterns.includes(from)) fail(`webpack copy rules miss from:"${from}"`);
}

if (failures.length > 0) {
  console.error(`check-realesrgan-assets: ${failures.length} failure(s).`);
  process.exit(1);
}
console.log(
  `check-realesrgan-assets: ${sourceFiles.size} source assets, `
  + `${registry.staticShapes.length} static shapes, build coverage OK.`,
);
