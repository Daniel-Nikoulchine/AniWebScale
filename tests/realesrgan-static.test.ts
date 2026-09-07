/**
 * Hebel 2.1 tests: static-shape build (protobuf dim-patch + structural
 * proof), shape-table sync, per-frame URL selection.
 * Hebel 2.3 tests: graph census gate (95 minimal nodes, no Split/Div).
 */
import { copyFileSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertDimOnlyDiff,
  buildVariantTo,
  censusGraphOps,
  extractIoShapes,
  graphInputConsumers,
  parseProto,
  patchStaticDims,
  serializeProto,
  STATIC_TARGETS,
  staticFileName,
} from '../scripts/build-realesrgan-static.mjs';
import {
  REALESRGAN_STATIC_SHAPES,
  realEsrganStaticModelFileForShape,
  selectRealEsrganModelUrl,
} from '../src/shared/realesrgan-models';

const MODEL_DIR = 'models/realesrgan';
const BASE_PATH = join(MODEL_DIR, 'RealESR-AnimeVideo-v3_x4.onnx');

function loadBase() {
  return parseProto(readFileSync(BASE_PATH));
}

describe('protobuf codec', () => {
  it('round-trips the base model byte-identically', () => {
    const bytes = readFileSync(BASE_PATH);
    expect(serializeProto(parseProto(bytes)).equals(bytes)).toBe(true);
  });

  it('reads symbolic base shapes, rejects them as concrete', () => {
    expect(() => extractIoShapes(loadBase())).toThrow(/symbolic/);
  });

  it('refuses to patch an already-static file (no double-patch accidents)', () => {
    const tree = loadBase();
    patchStaticDims(tree, 480, 640);
    expect(() => patchStaticDims(tree, 480, 640)).toThrow(/not \[batch,3,sym,sym\]/);
  });
});

describe('static variant build', () => {
  it('builds one variant with proven dim-only diff and exact shapes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'srvgg-static-'));
    copyFileSync(BASE_PATH, join(dir, 'RealESR-AnimeVideo-v3_x4.onnx'));
    const first = buildVariantTo(480, 640, dir, true);
    expect(first.skipped).toBe(false);
    expect(first.file).toBe('RealESR-AnimeVideo-v3_x4.static-480x640.onnx');
    // Idempotent: second run skips (fresh stamp).
    expect(buildVariantTo(480, 640, dir, false).skipped).toBe(true);
    // Force rebuilds and re-proves.
    expect(buildVariantTo(480, 640, dir, true).skipped).toBe(false);
    expect(statSync(join(dir, first.file)).size).toBeGreaterThan(1_000_000);
  }, 60_000);
});

describe('shape table sync (script <-> runtime)', () => {
  it('STATIC_TARGETS matches REALESRGAN_STATIC_SHAPES exactly', () => {
    const scriptShapes = STATIC_TARGETS
      .map(t => `${t.width}x${t.height}:${staticFileName(t.height, t.width)}`)
      .sort();
    const runtimeShapes = REALESRGAN_STATIC_SHAPES
      .map(s => `${s.width}x${s.height}:${s.file}`)
      .sort();
    expect(runtimeShapes).toEqual(scriptShapes);
  });

  it('realEsrganStaticModelFileForShape hits and misses', () => {
    expect(realEsrganStaticModelFileForShape(853, 480)).toBe('RealESR-AnimeVideo-v3_x4.static-480x853.onnx');
    expect(realEsrganStaticModelFileForShape(640, 480)).toBe('RealESR-AnimeVideo-v3_x4.static-480x640.onnx');
    // Odd/crop shapes fall back to the dynamic model.
    expect(realEsrganStaticModelFileForShape(852, 480)).toBeNull();
    expect(realEsrganStaticModelFileForShape(1920, 1080)).toBeNull();
  });

  it('selectRealEsrganModelUrl prefers verified static, else dynamic', () => {
    const statics = { '853x480': 'chrome://static-480x853' };
    expect(selectRealEsrganModelUrl('dyn', statics, 853, 480)).toBe('chrome://static-480x853');
    expect(selectRealEsrganModelUrl('dyn', statics, 640, 480)).toBe('dyn');
    expect(selectRealEsrganModelUrl('dyn', {}, 853, 480)).toBe('dyn');
  });
});

describe('Hebel 2.3 graph census gate', () => {
  it('pins the minimal 95-node graph (18 Conv / 17 PRelu, no Split/Div)', () => {
    const census = censusGraphOps(loadBase());
    expect(census).toMatchObject({
      Conv: 18,
      PRelu: 17,
      DepthToSpace: 1,
      Resize: 1,
      Add: 1,
      Clip: 1,
    });
    expect(census.Split ?? 0).toBe(0);
    expect(census.Div ?? 0).toBe(0);
    expect(census.Mul ?? 0).toBe(0);
    expect(census.Sub ?? 0).toBe(0);
    expect(census.Reshape ?? 0).toBe(0);
    expect(Object.values(census).reduce((a, b) => a + b, 0)).toBe(95);
  });

  it('input fans out directly (no Split node needed or present)', () => {
    const consumers = graphInputConsumers(loadBase());
    expect(consumers.length).toBeGreaterThanOrEqual(2);
    expect(consumers.map(c => c.op).sort()).toEqual(['Conv', 'Resize']);
  });

  it('proves the committed proof on the real base model', () => {
    // Full dim-only proof against a scratch variant (same assertions the
    // build runs per variant); guards the proof itself against bit-rot.
    const dir = mkdtempSync(join(tmpdir(), 'srvgg-proof-'));
    copyFileSync(BASE_PATH, join(dir, 'RealESR-AnimeVideo-v3_x4.onnx'));
    const { file } = buildVariantTo(405, 720, dir, true);
    const baseTree = parseProto(readFileSync(join(dir, 'RealESR-AnimeVideo-v3_x4.onnx')));
    const derivedTree = parseProto(readFileSync(join(dir, file)));
    expect(() => assertDimOnlyDiff(baseTree, derivedTree, 405, 720)).not.toThrow();
    expect(extractIoShapes(derivedTree)).toEqual({ input: [1, 3, 405, 720], output: [1, 3, 1620, 2880] });
  }, 60_000);
});
