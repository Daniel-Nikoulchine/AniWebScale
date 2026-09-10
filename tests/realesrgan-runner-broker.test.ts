/**
 * Runner broker: preference order, health retry and E2E override, driven
 * through injected fakes (no browser, no storage, no timers).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  NATIVE_RUNNER_RETRY_COOLDOWN_MS,
  RealEsrganRunnerBroker,
  shouldRetryNativeRunner,
  type RealEsrganInferenceRunner,
} from '../src/core/realesrgan-runner-broker';

describe('shouldRetryNativeRunner', () => {
  it('never retries without a recorded miss', () => {
    expect(shouldRetryNativeRunner(0, 1_000_000)).toBe(false);
  });

  it('retries only after the cooldown', () => {
    const missAt = 100_000;
    expect(shouldRetryNativeRunner(missAt, missAt + NATIVE_RUNNER_RETRY_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldRetryNativeRunner(missAt, missAt + NATIVE_RUNNER_RETRY_COOLDOWN_MS)).toBe(true);
    expect(shouldRetryNativeRunner(missAt, missAt + NATIVE_RUNNER_RETRY_COOLDOWN_MS + 60_000)).toBe(true);
  });

  it('ignores clock skew backwards', () => {
    expect(shouldRetryNativeRunner(200_000, 100_000)).toBe(false);
  });
});

function fakeRunner(tag: string): RealEsrganInferenceRunner {
  return { runFrame: async () => ({ tag }) } as unknown as RealEsrganInferenceRunner;
}

interface Harness {
  broker: RealEsrganRunnerBroker;
  nativeCalls: string[];
  storage: Map<string, unknown>;
  now: { t: number };
}

function makeHarness(options: {
  native?: Array<RealEsrganInferenceRunner | null>;
  worker?: RealEsrganInferenceRunner | null;
  e2eOverrides?: boolean;
} = {}): Harness {
  const nativeQueue = [...(options.native ?? [fakeRunner('native')])];
  const nativeCalls: string[] = [];
  const storage = new Map<string, unknown>();
  const now = { t: 1_000_000 };
  const broker = new RealEsrganRunnerBroker(
    {
      readStorageKey: async (key: string) => storage.get(key),
      now: () => now.t,
      createNativeRunner: async (engine) => {
        nativeCalls.push(engine);
        return nativeQueue.length > 0 ? nativeQueue.shift()! : null;
      },
      createWorkerRunner: async () => ('worker' in options ? options.worker! : fakeRunner('worker')),
    },
    options.e2eOverrides ?? false,
  );
  return { broker, nativeCalls, storage, now };
}

describe('RealEsrganRunnerBroker', () => {
  it('prefers native and caches it (one handshake)', async () => {
    const h = makeHarness();
    const first = await h.broker.resolveRunner();
    const second = await h.broker.resolveRunner();
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(h.nativeCalls).toEqual(['ncnn']);
  });

  it('falls back to the worker when native is missing', async () => {
    const h = makeHarness({ native: [null] });
    const runner = await h.broker.resolveRunner();
    expect(runner).not.toBeNull();
  });

  it('pins the miss inside the cooldown, retries after it', async () => {
    const h = makeHarness({ native: [null, fakeRunner('native-warm')] });
    await h.broker.resolveRunner();
    expect(h.nativeCalls).toEqual(['ncnn']);
    h.now.t += NATIVE_RUNNER_RETRY_COOLDOWN_MS - 1;
    await h.broker.resolveRunner();
    expect(h.nativeCalls).toEqual(['ncnn']);
    h.now.t += 1;
    const runner = await h.broker.resolveRunner();
    expect(runner).not.toBeNull();
    expect(h.nativeCalls).toEqual(['ncnn', 'ncnn']);
  });

  it('markRunnerDead drops the cached native runner; worker serves, then native retries after cooldown', async () => {
    const native = fakeRunner('native');
    const h = makeHarness({ native: [native, fakeRunner('native-2')] });
    const first = await h.broker.resolveRunner();
    expect(first).toBe(native);

    // Cooldown active: the next resolve falls through to the worker instead
    // of re-serving the runner the guard just buried. (Await the drop: the
    // escalation compares cached promises before forgetting them.)
    await h.broker.markRunnerDead(native);
    const duringCooldown = await h.broker.resolveRunner();
    expect(duringCooldown).not.toBeNull();
    expect(duringCooldown).not.toBe(native);
    // The native path is parked for the whole cooldown: no second handshake
    // before the cooldown elapses.
    expect(h.nativeCalls).toEqual(['ncnn']);

    // After the cooldown the native path is probed again (fresh adapter).
    h.now.t += NATIVE_RUNNER_RETRY_COOLDOWN_MS;
    await h.broker.resolveRunner();
    expect(h.nativeCalls).toEqual(['ncnn', 'ncnn']);
  });

  it('markRunnerDead drops the cached worker runner so it respawns fresh', async () => {
    const h = makeHarness({ native: [null] });
    const first = await h.broker.resolveRunner();
    await h.broker.markRunnerDead(first!);
    const second = await h.broker.resolveRunner();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('resolves null when neither runner exists', async () => {
    const h = makeHarness({ native: [null], worker: null });
    expect(await h.broker.resolveRunner()).toBeNull();
  });

  it('reads the vulkanSrvgg engine flag from storage', async () => {
    const h = makeHarness();
    h.storage.set('vulkanSrvgg', true);
    await h.broker.resolveRunner();
    expect(h.nativeCalls).toEqual(['srvgg']);
  });

  it('e2eForceWorker skips native entirely when overrides are on', async () => {
    const h = makeHarness({ e2eOverrides: true });
    h.storage.set('e2eForceWorker', true);
    const runner = await h.broker.resolveRunner();
    expect(runner).not.toBeNull();
    expect(h.nativeCalls).toEqual([]);
  });

  it('e2eForceWorker is ignored without overrides (production shape)', async () => {
    const h = makeHarness({ e2eOverrides: false });
    h.storage.set('e2eForceWorker', true);
    await h.broker.resolveRunner();
    expect(h.nativeCalls).toEqual(['ncnn']);
  });

  it('survives throwing storage', async () => {
    const broker = new RealEsrganRunnerBroker({
      readStorageKey: async () => { throw new Error('no storage'); },
      createNativeRunner: async () => fakeRunner('native'),
      createWorkerRunner: async () => fakeRunner('worker'),
    }, false);
    expect(await broker.resolveRunner()).not.toBeNull();
  });

  it('surfaces worker creation through the seam', async () => {
    const createWorkerRunner = vi.fn(async () => fakeRunner('worker'));
    const broker = new RealEsrganRunnerBroker({ createWorkerRunner }, false);
    await broker.resolveRunner();
    await broker.resolveRunner();
    expect(createWorkerRunner).toHaveBeenCalledTimes(1);
    expect(createWorkerRunner).toHaveBeenCalledWith(expect.stringContaining('pixels.wasm'));
  });
});
