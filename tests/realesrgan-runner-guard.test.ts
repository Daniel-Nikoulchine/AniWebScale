/**
 * Runner failover guard: retry budget, disable, fallback warmup. Runs
 * against fake tasks, no GPU: this policy used to be reachable only
 * through a fully constructed pipeline.
 */
import { describe, expect, it, vi } from 'vitest';
import { RealEsrganRunnerGuard } from '../src/core/realesrgan-runner-guard';
import {
  REALESRGAN_ERROR_CODES,
  withRealEsrganCode,
} from '../src/shared/realesrgan-error-codes';

const timeoutError = () => withRealEsrganCode(
  new Error('RealESRGAN worker inference timed out.'), REALESRGAN_ERROR_CODES.WORKER_TIMEOUT);
const permanentError = () => new Error('RealESRGAN worker client is disposed.');

describe('runner guard', () => {
  it('passes successes through and resets the timeout budget', async () => {
    const onTimeout = vi.fn();
    const guard = new RealEsrganRunnerGuard({ onTimeout });
    await expect(guard.guard(async () => 'a')).resolves.toBe('a');
    await expect(guard.guard(async () => { throw timeoutError(); })).rejects.toThrow();
    await expect(guard.guard(async () => 'b')).resolves.toBe('b');
    await expect(guard.guard(async () => { throw timeoutError(); })).rejects.toThrow();
    expect(onTimeout).toHaveBeenNthCalledWith(1, 1, 3, expect.anything());
    expect(onTimeout).toHaveBeenNthCalledWith(2, 1, 3, expect.anything());
    expect(guard.dead).toBe(false);
  });

  it('declares the runner dead after maxTimeouts consecutive timeouts', async () => {
    const order: string[] = [];
    const guard = new RealEsrganRunnerGuard({
      maxTimeouts: 3,
      onTimeout: () => { order.push('timeout'); },
      onRunnerDead: () => { order.push('dead'); },
      warmFallback: async () => { order.push('warm'); },
    });
    await expect(guard.guard(async () => { throw timeoutError(); })).rejects.toThrow();
    await expect(guard.guard(async () => { throw timeoutError(); })).rejects.toThrow();
    await expect(guard.guard(async () => { throw timeoutError(); })).rejects.toThrow();
    expect(guard.dead).toBe(true);
    expect(order).toEqual(['timeout', 'timeout', 'dead', 'warm']);
  });

  it('kills untagged errors on first sight without spending the budget', async () => {
    const onTimeout = vi.fn();
    const onRunnerDead = vi.fn();
    const warmFallback = vi.fn(async () => undefined);
    const guard = new RealEsrganRunnerGuard({ onTimeout, onRunnerDead, warmFallback });
    const error = permanentError();
    await expect(guard.guard(async () => { throw error; })).rejects.toBe(error);
    expect(guard.dead).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(onRunnerDead).toHaveBeenCalledWith(error);
    expect(warmFallback).toHaveBeenCalledOnce();
  });

  it('honors a custom budget', async () => {
    const onRunnerDead = vi.fn();
    const guard = new RealEsrganRunnerGuard({ maxTimeouts: 1, onRunnerDead });
    await expect(guard.guard(async () => { throw timeoutError(); })).rejects.toThrow();
    expect(guard.dead).toBe(true);
    expect(onRunnerDead).toHaveBeenCalledOnce();
  });

  it('propagates the runner error and still warms the fallback when escalation throws', async () => {
    const warmFallback = vi.fn(async () => undefined);
    const guard = new RealEsrganRunnerGuard({
      maxTimeouts: 1,
      onRunnerDead: () => { throw new Error('broker boom'); },
      warmFallback,
    });
    const error = permanentError();
    // The broker's error must not mask the runner's, and the fallback
    // warmup must still run for the next frame.
    await expect(guard.guard(async () => { throw error; })).rejects.toBe(error);
    expect(guard.dead).toBe(true);
    expect(warmFallback).toHaveBeenCalledOnce();
  });
});
