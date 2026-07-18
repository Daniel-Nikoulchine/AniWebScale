import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'acorn';

const sourcePath = path.resolve('node_modules/anime4k-webgpu/lib/index.js');
const outputDirectory = path.resolve('.generated/anime4k-webgpu');
const checkOnly = process.argv.includes('--check');

const bundles = {
  core: ['Conv2d', 'DepthToSpace', 'Overlay'],
  common: ['ClampHighlights'],
  'quality-m': ['CNNM', 'CNNSoftM', 'CNNx2M'],
  'quality-vl': ['CNNVL', 'CNNSoftVL', 'CNNx2VL', 'DenoiseCNNx2VL'],
  'quality-ul': ['CNNUL', 'CNNx2UL'],
};

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

const dependencies = new Map();
for (const [id, code] of moduleSources) {
  const referenced = new Set();
  for (const match of code.matchAll(/\bt\((\d+)\)/g)) referenced.add(match[1]);
  dependencies.set(id, referenced);
}

function findExportModule(exportName) {
  const escaped = exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assignment = new RegExp(`\\be\\.${escaped}(?:=|\\b)`);
  const harmonyExport = new RegExp(`\\b${escaped}:\\(\\)=>`);
  const candidates = [...moduleSources.entries()]
    .filter(([, code]) => assignment.test(code) || harmonyExport.test(code));
  if (candidates.length !== 1) {
    throw new Error(`Expected one module exporting ${exportName}, found ${candidates.length}.`);
  }
  return candidates[0][0];
}

function renderBundle(exportNames) {
  const syntheticEntryId = '999999';
  const exportModules = Object.fromEntries(
    exportNames.map(exportName => [exportName, findExportModule(exportName)]),
  );
  const exportGetters = exportNames
    .map(exportName => `${exportName}:()=>t(${exportModules[exportName]}).${exportName}`)
    .join(',');
  const syntheticEntry = `${syntheticEntryId}:(r,e,t)=>{t.r(e),t.d(e,{${exportGetters}})}`;
  const bundleSources = new Map(moduleSources);
  bundleSources.set(syntheticEntryId, syntheticEntry);

  const bundleDependencies = new Map(dependencies);
  bundleDependencies.set(
    syntheticEntryId,
    new Set(Object.values(exportModules)),
  );

  const reachable = new Set();
  const pending = [syntheticEntryId];
  while (pending.length > 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    if (!bundleSources.has(id)) throw new Error(`Missing referenced anime4k-webgpu module ${id}.`);
    reachable.add(id);
    bundleDependencies.get(id).forEach(dependency => pending.push(dependency));
  }

  const retainedModules = [
    ...moduleObject.properties
      .map(property => String(property.key.value ?? property.key.name))
      .filter(id => reachable.has(id))
      .map(id => bundleSources.get(id)),
    syntheticEntry,
  ];
  const originalRuntime = source.slice(moduleObject.end);
  const entryCalls = [...originalRuntime.matchAll(/\bt\((\d+)\)/g)];
  const entryCall = entryCalls.at(-1);
  if (!entryCall || entryCall.index === undefined) {
    throw new Error('Could not locate the anime4k-webgpu entry module.');
  }
  const runtime = originalRuntime.slice(0, entryCall.index)
    + `t(${syntheticEntryId})`
    + originalRuntime.slice(entryCall.index + entryCall[0].length);

  const generated = source.slice(0, moduleObject.start)
    + `{${retainedModules.join(',')}}`
    + runtime;
  if (/GANx3L|GANx4UUL|GANUUL/.test(generated)) {
    throw new Error('A split anime4k-webgpu bundle still contains a legacy GAN implementation.');
  }
  return { generated, retainedCount: retainedModules.length };
}

let changed = false;
for (const [bundleName, exportNames] of Object.entries(bundles)) {
  const outputPath = path.join(outputDirectory, `${bundleName}.js`);
  const { generated, retainedCount } = renderBundle(exportNames);
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
  if (current !== generated) {
    if (checkOnly) {
      throw new Error(`The ${bundleName} anime4k-webgpu bundle is out of date. Run npm run generate:anime4k-vendor.`);
    }
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(outputPath, generated);
    changed = true;
  }
  console.log(`anime4k-webgpu/${bundleName}: retained ${retainedCount} modules (${generated.length} bytes)`);
}

const legacyOutputPath = path.join(outputDirectory, 'index.js');
if (!checkOnly && fs.existsSync(legacyOutputPath)) fs.rmSync(legacyOutputPath);
if (!checkOnly && changed) console.log('anime4k-webgpu: split vendor bundles updated');
