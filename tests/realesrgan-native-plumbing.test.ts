/**
 * Plumbing tests for the native Vulkan client (Hebel 1-3).
 *
 * A real loopback HTTP server stands in for the host: it captures the POST
 * body and answers with canned RGBA8. This proves, end to end through the
 * client, that runFrameRgba sends byte-identical bytes to the planar path
 * (the bit-identity the fast path promises) and that the clone is lazy.
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  RealEsrganNativeVulkanClient,
  rehomeResponseBuffer,
} from '../src/core/realesrgan-native-vulkan-client';

interface CapturedRequest {
  url: string;
  body: Uint8Array;
}

let server: Server;
let port = 0;
let lastRequest: CapturedRequest | null = null;
// Behavior switches the fake host obeys per test.
let respondStatus = 200;
let respondWidth = 0;
let respondHeight = 0;
let respondBody: Uint8Array | null = null;

function readBody(request: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    request.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

beforeAll(async () => {
  server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = await readBody(request);
    lastRequest = { url: request.url ?? '', body: new Uint8Array(body) };
    const width = respondWidth;
    const height = respondHeight;
    const payload = respondBody ?? new Uint8Array(width * height * 4).fill(7);
    response.statusCode = respondStatus;
    if (respondStatus === 200) {
      response.setHeader('X-Frame-Width', String(width));
      response.setHeader('X-Frame-Height', String(height));
    }
    response.end(payload);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

beforeEach(() => {
  lastRequest = null;
  respondStatus = 200;
  respondWidth = 0;
  respondHeight = 0;
  respondBody = null;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function createClient(options?: { engine?: 'ncnn' | 'srvgg' }) {
  const client = await RealEsrganNativeVulkanClient.create({
    resolveEndpoint: () => Promise.resolve({ ok: true as const, port, token: 'test-token' }),
    ...(options?.engine ? { engine: options.engine } : {}),
  });
  if (!client) throw new Error('client creation failed with a live test server');
  return client;
}

function checkRgba(width: number, height: number): Uint8Array {
  // R walks every byte value exactly once (exhaustive roundtrip proof);
  // G/B cover wide ranges, alpha stays opaque like real video.
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = i % 256;
    rgba[i * 4 + 1] = (i * 91) % 256;
    rgba[i * 4 + 2] = (i * 53) % 256;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function planarFromRgba(rgba: Uint8Array, width: number, height: number): Float32Array {
  const pixels = width * height;
  const planar = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i += 1) {
    planar[i] = rgba[i * 4] / 255;
    planar[pixels + i] = rgba[i * 4 + 1] / 255;
    planar[2 * pixels + i] = rgba[i * 4 + 2] / 255;
  }
  return planar;
}

describe('native client RGBA fast path', () => {
  it('runFrameRgba POSTs the exact input bytes', async () => {
    const width = 16;
    const height = 16;
    respondWidth = width * 4;
    respondHeight = height * 4;
    const client = await createClient();
    try {
      const rgba = checkRgba(width, height);
      const result = await client.runFrameRgba('model', width, height, rgba);
      expect(result.width).toBe(width * 4);
      expect(result.height).toBe(height * 4);
      expect(result.data.length).toBe(width * 4 * (height * 4) * 4);
      expect(lastRequest).not.toBeNull();
      expect(lastRequest!.url).toContain(`w=${width}&h=${height}`);
      expect(lastRequest!.url).toContain('token=test-token');
      expect(lastRequest!.url).not.toContain('engine=');
      expect(lastRequest!.body).toEqual(rgba);
    } finally {
      client.dispose();
    }
  });

  it('Hebel E4: engine srvgg sends &engine=srvgg and labels native-srvgg', async () => {
    const width = 16;
    const height = 16;
    respondWidth = width * 4;
    respondHeight = height * 4;
    const client = await createClient({ engine: 'srvgg' });
    try {
      const paths: string[] = [];
      client.onFramePath = path => { paths.push(path); };
      const result = await client.runFrameRgba('model', width, height, checkRgba(width, height));
      expect(result.width).toBe(width * 4);
      expect(lastRequest).not.toBeNull();
      expect(lastRequest!.url).toContain('engine=srvgg');
      expect(paths.some(path => path.startsWith('native-srvgg '))).toBe(true);
    } finally {
      client.dispose();
    }
  });

  it('planar runFrame sends byte-identical bodies to runFrameRgba', async () => {
    const width = 16;
    const height = 16;
    respondWidth = width * 4;
    respondHeight = height * 4;
    const client = await createClient();
    try {
      const rgba = checkRgba(width, height);
      await client.runFrameRgba('model', width, height, rgba);
      const viaRgba = lastRequest!.body;
      await client.runFrame('model', null, width, height, planarFromRgba(rgba, width, height));
      const viaPlanar = lastRequest!.body;
      // The whole point of the fast path: skipping planar must not move a byte.
      expect(viaPlanar).toEqual(viaRgba);
      expect(viaPlanar).toEqual(rgba);
    } finally {
      client.dispose();
    }
  });

  it('rejects a wrongly sized RGBA buffer without touching the network', async () => {
    const client = await createClient();
    try {
      await expect(client.runFrameRgba('model', 4, 4, new Uint8Array(10))).rejects.toThrow(/holds|expected/);
      expect(lastRequest).toBeNull();
    } finally {
      client.dispose();
    }
  });

  it('rejects short host replies', async () => {
    respondWidth = 8;
    respondHeight = 8;
    respondBody = new Uint8Array(10);
    const client = await createClient();
    try {
      await expect(client.runFrameRgba('model', 2, 2, new Uint8Array(2 * 2 * 4))).rejects.toThrow(/expected/);
    } finally {
      client.dispose();
    }
  });

  it('surfaces a stale token and re-queries the endpoint', async () => {
    let queries = 0;
    const client = await RealEsrganNativeVulkanClient.create({
      resolveEndpoint: () => {
        queries += 1;
        return Promise.resolve({ ok: true as const, port, token: 'test-token' });
      },
    });
    if (!client) throw new Error('client creation failed');
    try {
      respondStatus = 403;
      await expect(client.runFrameRgba('model', 2, 2, new Uint8Array(2 * 2 * 4))).rejects.toThrow(/token/);
      expect(queries).toBeGreaterThanOrEqual(1);
    } finally {
      client.dispose();
    }
  });
});

describe('native host inference_failed stage', () => {
  it('surfaces upload/tile/submit stages from a 500 inference_failed reply', async () => {
    respondStatus = 500;
    const client = await createClient();
    try {
      for (const stage of ['upload', 'tile', 'submit'] as const) {
        respondBody = new TextEncoder().encode(`upscale failed (${stage}): simulated host failure`);
        let caught: unknown;
        try {
          await client.runFrameRgba('model', 2, 2, new Uint8Array(2 * 2 * 4));
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(Error);
        expect((caught as { stage?: string }).stage).toBe(stage);
        expect((caught as Error).message).toContain(`stage=${stage}`);
        // The existing transient code/classification is unchanged.
        expect((caught as { code?: string }).code).toBe('native-frame-failed');
      }
    } finally {
      client.dispose();
    }
  });

  it('leaves a stage-less error unchanged', async () => {
    respondStatus = 500;
    respondBody = new TextEncoder().encode('upscale failed: simulated host failure');
    const client = await createClient();
    try {
      let caught: unknown;
      try {
        await client.runFrameRgba('model', 2, 2, new Uint8Array(2 * 2 * 4));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as { stage?: string }).stage).toBeUndefined();
      expect((caught as Error).message).toContain('simulated host failure');
      expect((caught as Error).message).not.toContain('stage=');
      expect((caught as { code?: string }).code).toBe('native-frame-failed');
    } finally {
      client.dispose();
    }
  });
});

describe('rehomeResponseBuffer', () => {
  it('returns healthy buffers without cloning', () => {
    const raw = new Uint8Array([1, 2, 3, 4, 5]).buffer as ArrayBuffer;
    let clones = 0;
    const original = globalThis.structuredClone;
    vi.stubGlobal('structuredClone', (...args: [unknown]) => {
      clones += 1;
      return (original as (...a: [unknown]) => ArrayBuffer)(...args);
    });
    try {
      expect(rehomeResponseBuffer(raw)).toBe(raw);
      expect(clones).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('clones hostile buffers that refuse views', () => {
    const target = new ArrayBuffer(8);
    const hostile = new Proxy(target, {
      get(t, property, receiver) {
        if (property === 'byteLength') throw new Error('Permission denied to access property constructor');
        return Reflect.get(t, property, receiver);
      },
    }) as ArrayBuffer;
    let clones = 0;
    const original = globalThis.structuredClone;
    vi.stubGlobal('structuredClone', (..._args: [unknown]) => {
      clones += 1;
      return new ArrayBuffer(8);
    });
    try {
      const result = rehomeResponseBuffer(hostile);
      expect(clones).toBe(1);
      expect(result.byteLength).toBe(8);
      void original;
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
