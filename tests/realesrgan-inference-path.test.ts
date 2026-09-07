/**
 * Inference-path selection: truth tables for buffer planning and runner
 * dispatch. A new path (or Hebel) extends these tables, not drain
 * conditionals.
 */
import { describe, expect, it } from 'vitest';
import {
  planInferenceInput,
  selectRunnerPath,
  type InferenceInputCaps,
} from '../src/shared/realesrgan-inference-path';

const allCaps: InferenceInputCaps = {
  hasRunner: true,
  hasModelUrl: true,
  rgbaCapable: true,
  readbackRgba8: true,
  primed: true,
};

describe('planInferenceInput', () => {
  it('plans tight RGBA only when every condition holds', () => {
    expect(planInferenceInput(allCaps)).toBe('tight-rgba');
  });

  it('falls back to planar when any single condition drops', () => {
    const keys = Object.keys(allCaps) as (keyof InferenceInputCaps)[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(planInferenceInput({ ...allCaps, [key]: false })).toBe('planar');
    }
  });
});

describe('selectRunnerPath', () => {
  const runner = { runFrame: async () => undefined };
  const modelUrl = 'models/realesrgan/x4plus-anime.onnx';
  const rgba = new Uint8Array(4);
  const planar = new Float32Array(3);

  it('serves tight RGBA to a bound runner first', () => {
    const path = selectRunnerPath({ runner, modelUrl, rgba, planar });
    expect(path).toEqual({ kind: 'runner-rgba', modelUrl, rgba });
  });

  it('serves planar to a bound runner without RGBA input', () => {
    const path = selectRunnerPath({ runner, modelUrl, rgba: null, planar });
    expect(path).toEqual({ kind: 'runner-planar', modelUrl, planar });
  });

  it('reports none (runner side) when a bound runner has no input', () => {
    expect(selectRunnerPath({ runner, modelUrl, rgba: null, planar: null }))
      .toEqual({ kind: 'none', hasRunnerBinding: true });
  });

  it('treats a runner without model URL as no binding', () => {
    expect(selectRunnerPath({ runner, modelUrl: null, rgba: null, planar }))
      .toEqual({ kind: 'session', planar });
  });

  it('serves planar to the main-thread session without a binding', () => {
    const path = selectRunnerPath({ runner: null, modelUrl: null, rgba, planar });
    expect(path).toEqual({ kind: 'session', planar });
  });

  it('reports none (session side) with neither binding nor planar input', () => {
    expect(selectRunnerPath({ runner: null, modelUrl: null, rgba: null, planar: null }))
      .toEqual({ kind: 'none', hasRunnerBinding: false });
  });
});
