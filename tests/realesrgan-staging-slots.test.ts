import { describe, expect, it, vi } from 'vitest';
import { RealEsrganStagingSlots, type RealEsrganStagingClaim } from '../src/core/realesrgan-staging-slots';

function makeDevice(): { device: GPUDevice; created: GPUBuffer[] } {
  const created: GPUBuffer[] = [];
  const device = {
    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => {
      const buffer = { label: descriptor.label, destroy: vi.fn() } as unknown as GPUBuffer;
      created.push(buffer);
      return buffer;
    }),
  } as unknown as GPUDevice;
  return { device, created };
}

function makeSlots(count = 3): { slots: RealEsrganStagingSlots; device: GPUDevice; created: GPUBuffer[] } {
  const { device, created } = makeDevice();
  const slots = new RealEsrganStagingSlots(device, {
    count,
    size: 256,
    usage: 1 | 2,
    label: 'test staging',
  });
  return { slots, device, created };
}

describe('RealEsrganStagingSlots', () => {
  it('claims distinct handles until full, then null', () => {
    const { slots } = makeSlots(3);
    const first = slots.claim();
    const second = slots.claim();
    const third = slots.claim();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(new Set([first, second, third]).size).toBe(3);
    expect(slots.claim()).toBeNull();
  });

  it('release frees the claimed slot', () => {
    const { slots } = makeSlots(3);
    const first = slots.claim()!;
    const second = slots.claim()!;
    const third = slots.claim()!;
    expect(slots.claim()).toBeNull();
    slots.release(second);
    expect(slots.claim()).toBe(second);
    expect(slots.claim()).toBeNull();
    slots.release(first);
    slots.release(third);
    expect(slots.claim()).not.toBeNull();
  });

  it('release is idempotent and ignores foreign claims', () => {
    const { slots } = makeSlots(2);
    const first = slots.claim()!;
    const second = slots.claim()!;
    slots.release(first);
    slots.release(first);
    const foreign: RealEsrganStagingClaim = { index: 0, buffer: {} as GPUBuffer };
    slots.release(foreign);
    // The foreign release must not have freed slot 0 out from under a claim.
    expect(slots.claim()).toBe(first);
    expect(slots.claim()).toBeNull();
    slots.release(second);
  });

  it('markPending/takePending round-trips and clears', () => {
    const { slots } = makeSlots(2);
    const claim = slots.claim()!;
    slots.markPending(claim, 42);
    expect(slots.takePending()).toEqual({ claim, frame: 42 });
    expect(slots.takePending()).toBeNull();
  });

  it('releasePending consumes and frees the pending claim', () => {
    const { slots } = makeSlots(1);
    const claim = slots.claim()!;
    expect(slots.claim()).toBeNull();
    slots.markPending(claim, 7);
    expect(slots.releasePending()).toEqual({ claim, frame: 7 });
    expect(slots.takePending()).toBeNull();
    expect(slots.claim()).toBe(claim);
  });

  it('releases an unconsumed pending claim instead of overwriting it', () => {
    const { slots } = makeSlots(2);
    const first = slots.claim()!;
    const second = slots.claim()!;
    slots.markPending(first, 1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // A second markPending without an intervening take/release must not leak
    // the first claim's slot: it is released, and the new claim is pending.
    slots.markPending(second, 2);
    expect(warn).toHaveBeenCalled();
    expect(slots.takePending()).toEqual({ claim: second, frame: 2 });
    // The first slot is free again (third claim reuses it), the second is busy.
    expect(slots.claim()).toBe(first);
    expect(slots.claim()).toBeNull();
    warn.mockRestore();
  });

  it('exposes the slot count', () => {
    const { slots } = makeSlots(4);
    expect(slots.count).toBe(4);
  });

  it('destroy destroys each created buffer exactly once', () => {
    const { slots, created } = makeSlots(3);
    expect(created).toHaveLength(3);
    slots.destroy();
    for (const buffer of created) {
      expect(vi.mocked(buffer.destroy)).toHaveBeenCalledTimes(1);
    }
  });
});
