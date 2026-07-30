import { describe, expect, it } from 'vitest';
import { createAsyncSerializer } from '../src/shared/async-serializer';

describe('createAsyncSerializer', () => {
  it('runs operations sequentially, not concurrently', async () => {
    const serialized = createAsyncSerializer();
    const order: number[] = [];

    const p1 = serialized(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      order.push(1);
    });
    const p2 = serialized(async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it('returns the resolved value of each operation', async () => {
    const serialized = createAsyncSerializer();
    const result = await serialized(async () => 42);
    expect(result).toBe(42);
  });

  it('propagates rejections to the caller without poisoning the chain', async () => {
    const serialized = createAsyncSerializer();
    await expect(serialized(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    // The next operation must still run.
    const result = await serialized(async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('starts the next operation even if the previous one rejected', async () => {
    const serialized = createAsyncSerializer();
    const order: string[] = [];
    const p1 = serialized(async () => { order.push('fail'); throw new Error('x'); }).catch(() => undefined);
    const p2 = serialized(async () => { order.push('ok'); });
    await Promise.all([p1, p2]);
    expect(order).toEqual(['fail', 'ok']);
  });

  it('maintains independent chains per serializer instance', async () => {
    const a = createAsyncSerializer();
    const b = createAsyncSerializer();
    const order: string[] = [];

    const pa = a(async () => { await new Promise(r => setTimeout(r, 20)); order.push('a'); });
    const pb = b(async () => { order.push('b'); });

    await Promise.all([pa, pb]);
    // b should not wait for a's delay since they are separate chains.
    expect(order).toEqual(['b', 'a']);
  });
});
