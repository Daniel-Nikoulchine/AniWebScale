import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const outputDirectory = path.resolve('.generated/anime4k-models');
const sources = [
  {
    path: path.resolve('src/shared/generated-kernels.ts'),
    marker: 'export const GENERATED_KERNELS = ',
    names: {
      CNNSoftUL: 'cnn-soft-ul',
      DenoiseCNNx2M: 'denoise-cnn-x2-m',
      DenoiseCNNx2UL: 'denoise-cnn-x2-ul',
    },
  },
];

/**
 * Slice the JSON object literal that follows `marker` out of a generated
 * TypeScript module. Scans balanced braces while skipping double-quoted
 * strings (the generated output is JSON, so strings are always double-quoted
 * with backslash escapes), then JSON.parses the exact span. This is robust to
 * suffixes/annotations after the object and to brace characters inside WGSL
 * source strings — unlike indexOf/lastIndexOf slicing.
 */
function extractJsonObject(source, marker, sourcePath) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not find ${JSON.stringify(marker)} in ${sourcePath}.`);
  }
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start === -1) throw new Error(`No object literal after ${JSON.stringify(marker)} in ${sourcePath}.`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error(`Unterminated object literal after ${JSON.stringify(marker)} in ${sourcePath}.`);
}

function parseGeneratedObject(definition) {
  const source = fs.readFileSync(definition.path, 'utf8');
  return extractJsonObject(source, definition.marker, definition.path);
}

let changed = false;
for (const definition of sources) {
  const values = parseGeneratedObject(definition);
  for (const [name, filename] of Object.entries(definition.names)) {
    if (!values[name]) throw new Error(`Generated model ${name} is missing from ${definition.path}.`);
    const outputPath = path.join(outputDirectory, `${filename}.js`);
    const generated = `/* Generated model shard. Do not edit. */\nexport default ${JSON.stringify(values[name])};\n`;
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
    if (current === generated) continue;
    if (checkOnly) {
      throw new Error(`Generated model shard ${filename} is out of date. Run npm run generate:model-shards.`);
    }
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(outputPath, generated);
    changed = true;
  }
}

console.log(`anime4k models: ${changed ? 'updated' : 'verified'} 3 lazy-load shards`);
