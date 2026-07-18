import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const outputDirectory = path.resolve('.generated/anime4k-models');
const sources = [
  {
    path: path.resolve('src/shared/generated-kernels.ts'),
    marker: 'export const GENERATED_KERNELS = ',
    suffix: ' as const;',
    names: {
      CNNSoftUL: 'cnn-soft-ul',
      DenoiseCNNx2M: 'denoise-cnn-x2-m',
      DenoiseCNNx2UL: 'denoise-cnn-x2-ul',
    },
  },
  {
    path: path.resolve('src/shared/generated-external-glsl-models.ts'),
    marker: 'export const GENERATED_EXTERNAL_GLSL_MODELS = ',
    suffix: ' as const satisfies',
    names: {
      ArtCNNX2: 'artcnn-x2',
      ACNetX2: 'acnet-x2',
      ARNetX2: 'arnet-x2',
    },
  },
];

function parseGeneratedObject(definition) {
  const source = fs.readFileSync(definition.path, 'utf8');
  const start = source.indexOf(definition.marker);
  const end = source.lastIndexOf(definition.suffix);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not parse generated model object in ${definition.path}.`);
  }
  return JSON.parse(source.slice(start + definition.marker.length, end));
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

console.log(`anime4k models: ${changed ? 'updated' : 'verified'} 6 lazy-load shards`);
