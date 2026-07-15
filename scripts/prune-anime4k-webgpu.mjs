import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'acorn';

const sourcePath = path.resolve('node_modules/anime4k-webgpu/lib/index.js');
const outputPath = path.resolve('.generated/anime4k-webgpu/index.js');
const checkOnly = process.argv.includes('--check');

const source = fs.readFileSync(sourcePath, 'utf8');
const ast = parse(source, { ecmaVersion: 'latest' });
const objectExpressions = [];

function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ObjectExpression') objectExpressions.push(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    if (Array.isArray(value)) {
      value.forEach(child => visit(child));
    } else if (value && typeof value === 'object' && value.type) {
      visit(value);
    }
  }
}

visit(ast);

const moduleObject = objectExpressions
  .filter(node => node.properties.length > 100)
  .sort((left, right) => right.properties.length - left.properties.length)[0];

if (!moduleObject) throw new Error('Could not locate the anime4k-webgpu module table.');

const moduleSources = new Map(moduleObject.properties.map(property => {
  const id = String(property.key.value ?? property.key.name);
  return [id, source.slice(property.start, property.end)];
}));

const upscaleIndexId = [...moduleSources.entries()]
  .find(([, code]) => code.includes('t(1720)') && code.includes('t(3299)'))?.[0];

if (!upscaleIndexId) throw new Error('Could not locate the anime4k-webgpu upscale export module.');

let upscaleIndex = moduleSources.get(upscaleIndexId);
for (const removedModuleId of ['1720', '3299']) {
  const exportPattern = new RegExp(`,?x\\(t\\(${removedModuleId}\\),e\\),?`);
  const patched = upscaleIndex.replace(exportPattern, match => {
    const hasLeadingComma = match.startsWith(',');
    const hasTrailingComma = match.endsWith(',');
    return hasLeadingComma && hasTrailingComma ? ',' : '';
  });
  if (patched === upscaleIndex) {
    throw new Error(`Could not remove legacy GAN module ${removedModuleId} from the upscale exports.`);
  }
  upscaleIndex = patched;
}
moduleSources.set(upscaleIndexId, upscaleIndex);

const runtimeSource = source.slice(moduleObject.end);
const runtimeModuleCalls = [...runtimeSource.matchAll(/\bt\((\d+)\)/g)];
const entryModuleId = runtimeModuleCalls.at(-1)?.[1];
if (!entryModuleId) throw new Error('Could not locate the anime4k-webgpu entry module.');

const dependencies = new Map();
for (const [id, code] of moduleSources) {
  const referenced = new Set();
  for (const match of code.matchAll(/\bt\((\d+)\)/g)) referenced.add(match[1]);
  dependencies.set(id, referenced);
}

const reachable = new Set();
const pending = [entryModuleId];
while (pending.length > 0) {
  const id = pending.pop();
  if (reachable.has(id)) continue;
  if (!moduleSources.has(id)) throw new Error(`Missing referenced anime4k-webgpu module ${id}.`);
  reachable.add(id);
  dependencies.get(id).forEach(dependency => pending.push(dependency));
}

for (const removedModuleId of ['1720', '3299']) {
  if (reachable.has(removedModuleId)) {
    throw new Error(`Legacy GAN module ${removedModuleId} is still reachable.`);
  }
}

const retainedModules = moduleObject.properties
  .map(property => String(property.key.value ?? property.key.name))
  .filter(id => reachable.has(id))
  .map(id => moduleSources.get(id));
const generated = source.slice(0, moduleObject.start)
  + `{${retainedModules.join(',')}}`
  + source.slice(moduleObject.end);

if (/GANx3L|GANx4UUL/.test(generated)) {
  throw new Error('The pruned anime4k-webgpu bundle still contains GAN x3/x4 implementations.');
}

if (checkOnly) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== generated) {
    throw new Error('The pruned anime4k-webgpu bundle is out of date. Run npm run generate:anime4k-vendor.');
  }
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generated);
}

const removedCount = moduleSources.size - retainedModules.length;
console.log(`anime4k-webgpu: retained ${retainedModules.length} modules, removed ${removedCount} unused modules`);
