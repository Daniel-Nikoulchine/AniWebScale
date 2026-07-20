import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createS3Request,
  downloadEncryptedBackup,
  uploadEncryptedBackup,
} from '../lib/s3-backup-upload.mjs';

const settings = {
  endpoint: 'https://storage.example.test',
  bucket: 'backups-prod',
  key: 'aniwebscale/backup 01.json.gz.aes',
  region: 'eu-central-1',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  now: new Date('2026-07-17T12:34:56.000Z'),
};

describe('independent encrypted backup upload', () => {
  it('creates a scoped AWS Signature V4 request without exposing the secret', () => {
    const request = createS3Request({
      ...settings,
      method: 'PUT',
      payload: Buffer.from('encrypted payload'),
    });
    assert.equal(
      request.url.toString(),
      'https://storage.example.test/backups-prod/aniwebscale/backup%2001.json.gz.aes',
    );
    assert.match(request.headers.Authorization, /Credential=test-access-key\/20260717\/eu-central-1\/s3\/aws4_request/);
    assert.doesNotMatch(JSON.stringify(request), /test-secret-key/);
  });

  it('verifies the uploaded encrypted object with a signed HEAD request', async () => {
    const calls = [];
    const payload = Buffer.from('ciphertext');
    const result = await uploadEncryptedBackup({
      ...settings,
      payload,
      async fetchImpl(url, init) {
        calls.push({ url: String(url), method: init.method, authorization: init.headers.Authorization });
        return new Response(null, {
          status: 200,
          headers: init.method === 'HEAD' ? { 'content-length': String(payload.length) } : {},
        });
      },
    });
    assert.deepEqual(calls.map(call => call.method), ['PUT', 'HEAD']);
    assert.equal(result.bytes, payload.length);
  });

  it('downloads a bounded object with a signed GET request', async () => {
    const payload = Buffer.from('encrypted backup bytes');
    const result = await downloadEncryptedBackup({
      ...settings,
      maximumBytes: 1024,
      async fetchImpl(url, init) {
        assert.equal(init.method, 'GET');
        assert.match(init.headers.Authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
        assert.doesNotMatch(String(url), /test-secret-key/);
        return new Response(payload, {
          status: 200,
          headers: { 'content-length': String(payload.length) },
        });
      },
    });
    assert.deepEqual(result.payload, payload);
    assert.equal(result.bytes, payload.length);
  });

  it('rejects a declared object above the restore size limit before reading it', async () => {
    await assert.rejects(
      downloadEncryptedBackup({
        ...settings,
        maximumBytes: 10,
        async fetchImpl() {
          return new Response('too large', {
            status: 200,
            headers: { 'content-length': '11' },
          });
        },
      }),
      /size limit/,
    );
  });
});
