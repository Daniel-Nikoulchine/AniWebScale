import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'anime4k-webgpu/core': path.resolve(__dirname, '.generated/anime4k-webgpu/core.js'),
      'anime4k-webgpu/common': path.resolve(__dirname, '.generated/anime4k-webgpu/common.js'),
      'anime4k-webgpu/quality-m': path.resolve(__dirname, '.generated/anime4k-webgpu/quality-m.js'),
      'anime4k-webgpu/quality-vl': path.resolve(__dirname, '.generated/anime4k-webgpu/quality-vl.js'),
      'anime4k-webgpu/quality-ul': path.resolve(__dirname, '.generated/anime4k-webgpu/quality-ul.js'),
      'anime4k-model/cnn-soft-ul': path.resolve(__dirname, '.generated/anime4k-models/cnn-soft-ul.js'),
      'anime4k-model/denoise-cnn-x2-m': path.resolve(__dirname, '.generated/anime4k-models/denoise-cnn-x2-m.js'),
      'anime4k-model/denoise-cnn-x2-ul': path.resolve(__dirname, '.generated/anime4k-models/denoise-cnn-x2-ul.js'),
      'anime4k-model/artcnn-x2': path.resolve(__dirname, '.generated/anime4k-models/artcnn-x2.js'),
      'anime4k-model/acnet-x2': path.resolve(__dirname, '.generated/anime4k-models/acnet-x2.js'),
      'anime4k-model/arnet-x2': path.resolve(__dirname, '.generated/anime4k-models/arnet-x2.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
