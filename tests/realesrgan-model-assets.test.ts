/**
 * Modell-Auswahl: URL resolution, one-shot asset verification and the
 * per-frame static-shape pick, driven through the injected verifyAsset (no
 * global fetch stubbing).
 */
import { describe, expect, it } from 'vitest';
import { loadRealEsrganModelAssets } from '../src/core/realesrgan-model-assets';

const CLASS = 'RealEsrganX4';
const BASE_FILE = 'RealESR-AnimeVideo-v3_x4.onnx';

describe('loadRealEsrganModelAssets', () => {
  it('throws for an unknown class', async () => {
    await expect(loadRealEsrganModelAssets('NotAClass', { resolveUrl: p => p }))
      .rejects.toThrow('Unknown RealESRGAN pipeline class');
  });

  it('indexes only verified static shapes and picks by exact shape', async () => {
    const verified: string[] = [];
    const assets = await loadRealEsrganModelAssets(CLASS, {
      resolveUrl: path => `ext://${path}`,
      verifyAsset: async url => {
        verified.push(url);
        return url.endsWith('static-480x853.onnx');
      },
    });
    expect(assets.dynamicUrl).toBe(`ext://models/realesrgan/${BASE_FILE}`);
    expect(assets.urlForShape(853, 480)).toBe('ext://models/realesrgan/RealESR-AnimeVideo-v3_x4.static-480x853.onnx');
    expect(assets.urlForShape(640, 480)).toBe(assets.dynamicUrl);
    // Four static shapes were each verified exactly once.
    expect(verified.filter(url => url.includes('static-')).length).toBe(4);
  });

  it('resolves fp16 only when its asset verifies', async () => {
    const found = await loadRealEsrganModelAssets(CLASS, {
      resolveUrl: path => `ext://${path}`,
      verifyAsset: async () => false,
    });
    expect(found.fp16Url).toBeNull();
  });

  it('lets an explicit fp16Url win, including null', async () => {
    const pinned = await loadRealEsrganModelAssets(CLASS, {
      resolveUrl: path => `ext://${path}`,
      verifyAsset: async () => true,
      fp16Url: 'ext://pinned.fp16.onnx',
    });
    expect(pinned.fp16Url).toBe('ext://pinned.fp16.onnx');

    const forced = await loadRealEsrganModelAssets(CLASS, {
      resolveUrl: path => `ext://${path}`,
      verifyAsset: async () => true,
      fp16Url: null,
    });
    expect(forced.fp16Url).toBeNull();
  });

  it('skips static and fp16 variants under the E2E model-file override', async () => {
    const assets = await loadRealEsrganModelAssets(CLASS, {
      resolveUrl: path => `ext://${path}`,
      verifyAsset: async () => true,
      readStorageKey: async key => (key === 'e2eModelFile' ? 'override.onnx' : undefined),
    });
    expect(assets.dynamicUrl).toBe('ext://models/realesrgan/override.onnx');
    expect(assets.fp16Url).toBeNull();
    expect(assets.urlForShape(853, 480)).toBe(assets.dynamicUrl);
  });
});
