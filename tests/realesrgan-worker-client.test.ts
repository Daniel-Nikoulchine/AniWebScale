/**
 * RealEsrganWorkerClient driven through its injectable primitives (fake
 * worker handle, fake timers): spawn discipline, init handshake, request
 * queue/backpressure accounting, timeout and error-code tagging. The seam
 * with the most browser-specific behavior finally gets direct tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealEsrganWorkerClient, type RealEsrganWorkerHandle } from '../src/core/realesrgan-worker-client';
import { realEsrganErrorCodeOf, REALESRGAN_ERROR_CODES } from '../src/shared/realesrgan-error-codes';

interface FakeWorkerHandle {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  terminate: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  sent: unknown[];
  terminated: boolean;
  /** Reply factory; when absent the worker stays silent (timeout tests). */
  respond: ((message: Record<string, unknown>) => unknown) | null;
}

function fakeWorker(options: { respond?: FakeWorkerHandle['respond'] } = {}): FakeWorkerHandle {
  const handle: FakeWorkerHandle = {
    sent: [],
    terminated: false,
    respond: options.respond ?? null,
    onmessage: null,
    onerror: null,
    terminate() {
      handle.terminated = true;
    },
    postMessage(message) {
      handle.sent.push(message);
      const reply = handle.respond
        ? handle.respond(message as Record<string, unknown>)
        : undefined;
      if (reply !== undefined) {
        queueMicrotask(() => handle.onmessage?.({ data: reply }));
      }
    },
  };
  return handle;
}

function readyClient(handle: FakeWorkerHandle, extra = {}) {
  return RealEsrganWorkerClient.create({
    resolveUrl: (path: string) => `ext://${path}`,
    loadScript: async () => 'worker-source',
    createBlobUrl: () => 'blob:worker',
    revokeBlobUrl: () => undefined,
    spawnWorker: () => handle as unknown as RealEsrganWorkerHandle,
    initTimeoutMs: 5_000,
    inferTimeoutMs: 5_000,
    maxConcurrentRequests: 1,
    ...extra,
  });
}

const okFrameReply = (message: Record<string, unknown>) => ({
  type: 'infer',
  id: message.id,
  ok: true,
  width: 2,
  height: 2,
  data: new Uint8Array(16),
  path: 'cpu-single-gpu',
});

describe('RealEsrganWorkerClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('spawns, handshakes and serves one frame', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : okFrameReply(message)),
    });
    const client = await readyClient(handle);
    expect(client).not.toBeNull();
    expect(handle.sent[0]).toMatchObject({ type: 'init', ortUrl: 'ext://ort/ort.webgpu.min.mjs' });

    const paths: string[] = [];
    client!.onFramePath = path => paths.push(path);
    const result = await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    expect(result).toMatchObject({ width: 2, height: 2 });
    expect(paths).toEqual(['cpu-single-gpu']);
    client!.dispose();
  });

  it('maps the worker fp16 report onto the frame result', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init'
        ? { type: 'init', ok: true }
        : { ...okFrameReply(message), fp16: true }),
    });
    const client = await readyClient(handle);
    const fp16 = await client!.runFrame('m.onnx', 'f.onnx', 2, 2, new Float32Array(12));
    expect(fp16.precision).toBe('fp16');
    client!.dispose();

    const handle2 = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : okFrameReply(message)),
    });
    const client2 = await readyClient(handle2);
    // Replies without the report (older worker, native-shaped fakes) count
    // as fp32 — unknown never claims fp16.
    const fp32 = await client2!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    expect(fp32.precision).toBe('fp32');
    client2!.dispose();
  });

  it('settles the frame and keeps pumping when onFramePath throws', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : okFrameReply(message)),
    });
    const client = await readyClient(handle);
    client!.onFramePath = () => { throw new Error('hook boom'); };
    // The diagnostics hook must not wedge the frame promise (previously it
    // fired before resolve/pump, hanging this await and the queue behind it).
    const first = await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    expect(first).toMatchObject({ width: 2, height: 2 });
    const second = await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    expect(second).toMatchObject({ width: 2, height: 2 });
    client!.dispose();
  });

  it('resolves null when the worker script cannot be loaded', async () => {
    const client = await RealEsrganWorkerClient.create({
      loadScript: async () => { throw new Error('404'); },
    });
    expect(client).toBeNull();
  });

  it('revokes the blob URL even when spawn fails', async () => {
    const revoked: string[] = [];
    const client = await RealEsrganWorkerClient.create({
      resolveUrl: (path: string) => `ext://${path}`,
      loadScript: async () => 'worker-source',
      createBlobUrl: () => 'blob:worker',
      revokeBlobUrl: url => revoked.push(url),
      spawnWorker: () => { throw new Error('SecurityError'); },
    });
    expect(client).toBeNull();
    expect(revoked).toEqual(['blob:worker']);
  });

  it('resolves null on init handshake timeout and terminates the worker', async () => {
    const handle = fakeWorker(); // stays silent
    const clientPromise = readyClient(handle, { initTimeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await clientPromise).toBeNull();
    expect(handle.terminated).toBe(true);
  });

  it('tags a coded timeout reply as transient (WORKER_TIMEOUT)', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init'
        ? { type: 'init', ok: true }
        : { type: 'infer', id: message.id, ok: false, code: 'worker-timeout', error: 'RealESRGAN session.run timed out after 8s' }),
    });
    const client = await readyClient(handle);
    const error = await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12)).catch(e => e);
    expect(realEsrganErrorCodeOf(error)).toBe(REALESRGAN_ERROR_CODES.WORKER_TIMEOUT);
    client!.dispose();
  });

  it('tags a coded permanent failure as WORKER_FAILED', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init'
        ? { type: 'init', ok: true }
        : { type: 'infer', id: message.id, ok: false, code: 'worker-failed', error: 'boom' }),
    });
    const client = await readyClient(handle);
    const error = await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12)).catch(e => e);
    expect(realEsrganErrorCodeOf(error)).toBe(REALESRGAN_ERROR_CODES.WORKER_FAILED);
    client!.dispose();
  });

  it('treats an uncoded failure as permanent (default semantics)', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init'
        ? { type: 'init', ok: true }
        : { type: 'infer', id: message.id, ok: false, error: 'legacy reply without code' }),
    });
    const client = await readyClient(handle);
    const error = await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12)).catch(e => e);
    expect(realEsrganErrorCodeOf(error)).toBe(REALESRGAN_ERROR_CODES.WORKER_FAILED);
    client!.dispose();
  });

  it('rejects with WORKER_TIMEOUT when the client timer fires first, and pumps the queue', async () => {
    // Answers init, then goes silent for infer: the client timer must fire.
    const handle = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : undefined),
    });
    const client = await readyClient(handle, { inferTimeoutMs: 1_000 });
    // Attach the catch handlers BEFORE the timers fire, or vitest flags the
    // momentarily-unhandled rejections.
    const first = client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12)).catch(e => e);
    const second = client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12)).catch(e => e);
    // First request times out at t=1000 and pumps the queued second one,
    // whose own timer fires at t=2000.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(realEsrganErrorCodeOf(await first)).toBe(REALESRGAN_ERROR_CODES.WORKER_TIMEOUT);
    expect(realEsrganErrorCodeOf(await second)).toBe(REALESRGAN_ERROR_CODES.WORKER_TIMEOUT);
    client!.dispose();
  });

  it('keeps depth-1 ordering: the second request posts only after the first reply', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : okFrameReply(message)),
    });
    const client = await readyClient(handle);
    const first = client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    const second = client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    // Only init + first infer are out so far.
    expect(handle.sent.length).toBe(2);
    await Promise.all([first, second]);
    expect(handle.sent.length).toBe(3);
    client!.dispose();
  });

  it('rejects an invalid output shape and keeps the slot available', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init'
        ? { type: 'init', ok: true }
        : { type: 'infer', id: message.id, ok: true, width: 9, height: 9, data: new Uint8Array(4) }),
    });
    const client = await readyClient(handle);
    const bad = client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    const good = client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    await expect(bad).rejects.toThrow('invalid output shape');
    // Depth 1: the second request must still have been served after the
    // rejected one freed its slot.
    await expect(good).rejects.toThrow('invalid output shape');
    expect(handle.sent.length).toBe(3);
    client!.dispose();
  });

  it('rejects when postMessage throws and keeps the queue moving', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : okFrameReply(message)),
    });
    const client = await readyClient(handle);
    handle.postMessage = () => { throw new Error('detached buffer'); };
    // The failing postMessage may be the init retry or an infer; both paths
    // must settle without wedging the queue.
    await expect(client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12))).rejects.toThrow();
    client!.dispose();
  });

  it('forwards target dims only through the protocol builder (0 = full 4x)', async () => {
    const handle = fakeWorker({
      respond: message => (message.type === 'init' ? { type: 'init', ok: true } : okFrameReply(message)),
    });
    const client = await readyClient(handle);
    await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12));
    await client!.runFrame('m.onnx', null, 2, 2, new Float32Array(12), 4, 4);
    const inferMessages = handle.sent.filter(m => (m as { type?: string }).type === 'infer') as Array<Record<string, unknown>>;
    expect(inferMessages[0]).not.toHaveProperty('targetWidth');
    expect(inferMessages[1]).toMatchObject({ targetWidth: 4, targetHeight: 4 });
    client!.dispose();
  });
});
