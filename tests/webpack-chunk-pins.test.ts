/**
 * Chunk-path pins: the runtime-resolved asset paths (worker client, Modell-
 * Auswahl, browser setup) must match the webpack CopyPlugin entries. Every
 * pair here used to be coupled only by convention — a rename broke at
 * RUNTIME (worker 404 → silent fallback; ort wasmPaths drift → the whole
 * RealESRGAN path dead after four frames), never at build time. This test
 * reads webpack.config.js (CommonJS source) and asserts the pairings.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REALESRGAN_PIXELS_WASM_CHUNK } from '../src/shared/realesrgan-models';

const repoRoot = resolve(__dirname, '..');
const config = readFileSync(resolve(repoRoot, 'webpack.config.js'), 'utf8');

describe('runtime asset paths are pinned to webpack CopyPlugin entries', () => {
  it('the ORT bundle path the worker client resolves exists as a copy target', () => {
    // realesrgan-worker-client.ts resolves 'ort/ort.webgpu.min.mjs' + wasmDir 'ort/'.
    expect(config).toContain("to: 'ort/ort.webgpu.min.mjs'");
    expect(config).toContain("to: 'ort/");
  });

  it('the WASM-SIMD compose chunk constant matches the copy target', () => {
    expect(config).toContain(`to: '${REALESRGAN_PIXELS_WASM_CHUNK}'`);
  });

  it('the inference worker ships via the chunk glob its client resolves', () => {
    // realesrgan-worker-client.ts resolves 'chunks/realesrgan-inference-worker.js',
    // which webpack derives from the src/worker glob + chunks/[name][ext].
    expect(config).toContain("{ from: 'src/worker/*.js', to: 'chunks/[name][ext]' }");
    expect(readFileSync === undefined).toBe(false);
    expect(existsSync(resolve(repoRoot, 'src/worker/realesrgan-inference-worker.js'))).toBe(true);
  });

  it('the model asset directory the Modell-Auswahl resolves is copied', () => {
    // realesrgan-model-assets.ts resolves 'models/realesrgan/<file>'.
    expect(config).toContain("{ from: 'models', to: 'models'");
  });

  it('the browser setup wasmPaths root matches the copied ort runtime', () => {
    // realesrgan-browser-setup.ts points env.wasm.wasmPaths at 'ort/' — the
    // same directory the bundle targets above copy into.
    expect(config).toContain("to: 'ort/");
  });
});
