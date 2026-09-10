/**
 * Canonical names of the lazy renderer chunks emitted into each dist dir's
 * `chunks` subdirectory.
 *
 * NOTE: the source of truth for these names is the `webpackChunkName` magic
 * comment on every dynamic `import()` in `src/core/pipeline-loader.ts` (that
 * file is owned elsewhere). This module only mirrors them for the bundle-size
 * gate; when a loader chunk is added or renamed, update this list and the
 * quality gate in the same change.
 */
export const REQUIRED_LAZY_CHUNKS = [
  'anime4k-common.js',
  'anime4k-quality-m.js',
  'anime4k-quality-vl.js',
  'anime4k-quality-ul.js',
  'model-cnn-soft-ul.js',
  'model-denoise-cnn-x2-m.js',
  'model-denoise-cnn-x2-ul.js',
  'model-artcnn-x2.js',
  'model-acnet-x2.js',
  'model-arnet-x2.js',
];
