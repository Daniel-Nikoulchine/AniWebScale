/**
 * Worker protocol seam: reply guard, message builders and the code literals
 * the import-free worker inlines. The builders are the only sanctioned way to
 * construct messages, so malformed inputs must be handled predictably here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildWorkerInferMessage,
  buildWorkerInitMessage,
  isWorkerReply,
  WORKER_REPLY_ERROR_CODES,
} from '../src/shared/realesrgan-worker-protocol.js';
import { REALESRGAN_ERROR_CODES } from '../src/shared/realesrgan-error-codes';

describe('isWorkerReply', () => {
  it('accepts init and infer replies', () => {
    expect(isWorkerReply({ type: 'init', ok: true })).toBe(true);
    expect(isWorkerReply({ type: 'infer', id: 1, ok: false })).toBe(true);
  });

  it('rejects malformed values without throwing', () => {
    for (const value of [null, undefined, 0, 1, '', 'infer', true, [], () => {}]) {
      expect(isWorkerReply(value)).toBe(false);
    }
    expect(isWorkerReply({})).toBe(false);
    expect(isWorkerReply({ type: 'unknown' })).toBe(false);
  });
});

describe('buildWorkerInitMessage', () => {
  it('omits pixelsUrl when absent, empty or not a string', () => {
    expect(buildWorkerInitMessage({ ortUrl: 'o', wasmDir: 'w' })).toEqual({ type: 'init', ortUrl: 'o', wasmDir: 'w' });
    expect(buildWorkerInitMessage({ ortUrl: 'o', wasmDir: 'w', pixelsUrl: '' })).toEqual({ type: 'init', ortUrl: 'o', wasmDir: 'w' });
    expect(buildWorkerInitMessage({ ortUrl: 'o', wasmDir: 'w', pixelsUrl: undefined })).toEqual({ type: 'init', ortUrl: 'o', wasmDir: 'w' });
  });

  it('carries a non-empty pixelsUrl', () => {
    expect(buildWorkerInitMessage({ ortUrl: 'o', wasmDir: 'w', pixelsUrl: 'p.wasm' }))
      .toEqual({ type: 'init', ortUrl: 'o', wasmDir: 'w', pixelsUrl: 'p.wasm' });
  });
});

describe('buildWorkerInferMessage', () => {
  const base = {
    id: 7,
    modelUrl: 'm.onnx',
    modelUrlFp16: null,
    width: 2,
    height: 2,
    data: new Float32Array(12),
  };

  it('omits target dims unless both are positive integers', () => {
    expect(buildWorkerInferMessage(base)).not.toHaveProperty('targetWidth');
    expect(buildWorkerInferMessage({ ...base, targetWidth: 0, targetHeight: 0 })).not.toHaveProperty('targetWidth');
    expect(buildWorkerInferMessage({ ...base, targetWidth: 4, targetHeight: 0 })).not.toHaveProperty('targetWidth');
    expect(buildWorkerInferMessage({ ...base, targetWidth: 4.5, targetHeight: 4 })).not.toHaveProperty('targetWidth');
    expect(buildWorkerInferMessage({ ...base, targetWidth: -4, targetHeight: 4 })).not.toHaveProperty('targetWidth');
  });

  it('carries both target dims when positive', () => {
    const message = buildWorkerInferMessage({ ...base, targetWidth: 8, targetHeight: 6 });
    expect(message).toMatchObject({ targetWidth: 8, targetHeight: 6 });
    expect(message.data).toBe(base.data);
  });
});

describe('worker inline reply codes', () => {
  it('match the canonical taxonomy', () => {
    const worker = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/worker/realesrgan-inference-worker.js'),
      'utf8',
    );
    const timeout = worker.match(/const WORKER_REPLY_TIMEOUT = '([^']+)';/)?.[1];
    const failed = worker.match(/const WORKER_REPLY_FAILED = '([^']+)';/)?.[1];
    expect(timeout).toBe(WORKER_REPLY_ERROR_CODES.TIMEOUT);
    expect(failed).toBe(WORKER_REPLY_ERROR_CODES.FAILED);
    expect(WORKER_REPLY_ERROR_CODES.TIMEOUT).toBe(REALESRGAN_ERROR_CODES.WORKER_TIMEOUT);
    expect(WORKER_REPLY_ERROR_CODES.FAILED).toBe(REALESRGAN_ERROR_CODES.WORKER_FAILED);
  });
});
