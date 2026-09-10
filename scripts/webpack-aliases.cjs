// Single source of truth for the generated anime4k-webgpu / anime4k-model
// module aliases. Both webpack.config.js and vitest.config.ts import this map,
// so a bundle rename cannot drift between the production build and the unit
// test resolver. The keys MUST stay in sync with the `webpackChunkName` magic
// comments in src/core/pipeline-loader.ts and the generator bundle tables
// (scripts/prune-anime4k-webgpu.mjs, scripts/generate-model-shards.mjs);
// scripts/check-alias-parity.mjs enforces that.
//
// Keys are the bare specifiers; consumers adapt them:
//   - webpack needs an exact-match `$` suffix (toWebpackAliases)
//   - vitest accepts the bare prefix keys as-is
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const generated = (...segments) => path.resolve(root, '.generated', ...segments);

const ANIME4K_ALIASES = {
  'anime4k-webgpu/core': generated('anime4k-webgpu', 'core.js'),
  'anime4k-webgpu/common': generated('anime4k-webgpu', 'common.js'),
  'anime4k-webgpu/quality-m': generated('anime4k-webgpu', 'quality-m.js'),
  'anime4k-webgpu/quality-vl': generated('anime4k-webgpu', 'quality-vl.js'),
  'anime4k-webgpu/quality-ul': generated('anime4k-webgpu', 'quality-ul.js'),
};

const ANIME4K_MODEL_ALIASES = {
  'anime4k-model/cnn-soft-ul': generated('anime4k-models', 'cnn-soft-ul.js'),
  'anime4k-model/denoise-cnn-x2-m': generated('anime4k-models', 'denoise-cnn-x2-m.js'),
  'anime4k-model/denoise-cnn-x2-ul': generated('anime4k-models', 'denoise-cnn-x2-ul.js'),
  'anime4k-model/artcnn-x2': generated('anime4k-models', 'artcnn-x2.js'),
  'anime4k-model/acnet-x2': generated('anime4k-models', 'acnet-x2.js'),
  'anime4k-model/arnet-x2': generated('anime4k-models', 'arnet-x2.js'),
};

const GENERATED_ALIASES = { ...ANIME4K_ALIASES, ...ANIME4K_MODEL_ALIASES };

/** webpack's enhanced-resolve wants an exact-match `$` on each alias key. */
function toWebpackAliases(aliases = GENERATED_ALIASES) {
  return Object.fromEntries(Object.entries(aliases).map(([key, value]) => [`${key}$`, value]));
}

module.exports = { ANIME4K_ALIASES, ANIME4K_MODEL_ALIASES, GENERATED_ALIASES, toWebpackAliases };
