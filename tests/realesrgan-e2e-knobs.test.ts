/**
 * Knob registry: every knob round-trips env -> query -> bridge -> storage
 * with the exact rules the hand-written code had. A new knob must arrive
 * as one table row; this matrix fails when a hop forgets it.
 */
import { describe, expect, it } from 'vitest';
import {
  E2E_BRIDGE_ACTIONS,
  E2E_KNOBS,
  e2eKnobQueryKeys,
  knobBridgeFromQuery,
  knobQueryFromEnv,
  knobStorageFromBridge,
} from '../src/shared/realesrgan-e2e-knobs.js';
import { REALESRGAN_CAP_LADDER } from '../src/shared/realesrgan-auto-cap';

import type { E2eKnob } from '../src/shared/realesrgan-e2e-knobs.js';

const byQuery: Record<string, E2eKnob> = Object.fromEntries(E2E_KNOBS.map(knob => [knob.query, knob]));

function roundtrip(env: string | undefined, queryKey: string) {
  const knob = byQuery[queryKey]!;
  const query = knobQueryFromEnv(knob, env);
  const bridge = query === undefined ? undefined : knobBridgeFromQuery(knob, query);
  const storage = bridge === undefined ? null : knobStorageFromBridge(knob, bridge);
  return { query, bridge, storage };
}

describe('knob registry shape', () => {
  it('covers every known knob exactly once per hop name', () => {
    for (const key of ['env', 'query'] as const) {
      const names = E2E_KNOBS.map(knob => knob[key]);
      expect(new Set(names).size).toBe(names.length);
    }
    expect(e2eKnobQueryKeys().sort()).toEqual(
      E2E_KNOBS.map(knob => knob.query).sort(),
    );
  });

  it('freezes the bridge action names the page posts', () => {
    expect(E2E_BRIDGE_ACTIONS).toEqual({
      CONFIGURE: 'configure',
      CONFIGURE_REALESRGAN: 'configure-realesrgan',
      GET_LOGS: 'get-logs',
      FORCE_OVERLOAD: 'force-overload',
      GET_STATS: 'get-stats',
    });
  });
});

describe('knob roundtrips (legacy rules pinned)', () => {
  it('backend: native stays native, anything else becomes webgpu', () => {
    expect(roundtrip('native', 'backend')).toEqual({
      query: 'native', bridge: 'native', storage: { backend: 'native' },
    });
    expect(roundtrip('webgpu', 'backend')).toEqual({
      query: 'webgpu', bridge: 'webgpu', storage: { backend: 'webgpu' },
    });
    expect(roundtrip(undefined, 'backend').query).toBeUndefined();
  });

  it('capHeight: only 360|405|432|480 survive to the bridge', () => {
    expect(roundtrip('432', 'cap').bridge).toBe(432);
    expect(roundtrip('360', 'cap').bridge).toBe(360);
    expect(roundtrip('500', 'cap').bridge).toBeUndefined();
    expect(roundtrip('432', 'cap').storage).toEqual({ realesrganCapHeight: 432 });
  });

  it('capHeight bridge accepts exactly the Auto-Cap ladder rungs (drift guard)', () => {
    // The ladder lives in realesrgan-auto-cap.ts while the bridge validates
    // hardcoded literals — this cross-check makes a rung added/removed on
    // one side fail here instead of silently breaking the E2E gates.
    const knob = byQuery['cap']!;
    for (const rung of REALESRGAN_CAP_LADDER) {
      expect(knobBridgeFromQuery(knob, String(rung))).toBe(rung);
    }
    const legacy = [405, 432, 480].filter(h => !(REALESRGAN_CAP_LADDER as ReadonlyArray<number>).includes(h));
    for (const height of legacy) {
      expect(knobBridgeFromQuery(knob, String(height))).toBeUndefined();
    }
    expect(knobBridgeFromQuery(knob, String(Math.min(...REALESRGAN_CAP_LADDER) - 1))).toBeUndefined();
  });

  it('flags: only "1" arms, storage only on true', () => {
    for (const query of ['srvggVulkan', 'forceWorker', 'forceOverload']) {
      const knob = byQuery[query];
      expect(knobQueryFromEnv(knob, '1')).toBe('1');
      expect(knobQueryFromEnv(knob, '0')).toBeUndefined();
      expect(knobBridgeFromQuery(knob, '1')).toBe(true);
    }
    expect(roundtrip('1', 'srvggVulkan').storage).toEqual({ vulkanSrvgg: true });
    expect(roundtrip('1', 'forceWorker').storage).toEqual({ e2eForceWorker: true });
    // Page-only knob: bridge value exists, storage stays empty.
    expect(roundtrip('1', 'forceOverload')).toEqual({
      query: '1', bridge: true, storage: null,
    });
  });

  it('modelFile passes through as a string', () => {
    expect(roundtrip('custom.onnx', 'modelFile')).toEqual({
      query: 'custom.onnx', bridge: 'custom.onnx', storage: { e2eModelFile: 'custom.onnx' },
    });
    expect(roundtrip(undefined, 'modelFile').query).toBeUndefined();
  });

  it('precision: only fp32|fp16|int8 survive to storage', () => {
    expect(roundtrip('int8', 'precision')).toEqual({
      query: 'int8', bridge: 'int8', storage: { realesrganPrecision: 'int8' },
    });
    expect(roundtrip('fp16', 'precision').storage).toEqual({ realesrganPrecision: 'fp16' });
    expect(roundtrip('fp32', 'precision').storage).toEqual({ realesrganPrecision: 'fp32' });
    expect(roundtrip('half', 'precision').bridge).toBeUndefined();
    expect(roundtrip(undefined, 'precision').query).toBeUndefined();
  });
});
