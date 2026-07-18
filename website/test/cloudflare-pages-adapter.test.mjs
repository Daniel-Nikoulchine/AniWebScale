import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPagesRequestHandler } from '../functions/api/[[path]].js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wranglerConfigPath = resolve(__dirname, '..', 'wrangler.jsonc');

async function readWranglerConfig() {
  let raw = await readFile(wranglerConfigPath, 'utf8');
  raw = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(raw);
}

describe('Cloudflare Pages request adapter', () => {
  it('keeps waitUntil bound to the Pages event context', async () => {
    const tasks = [];
    const context = {
      request: new Request('https://example.test/api/license'),
      env: Object.freeze({}),
      waitUntil(promise) {
        assert.equal(this, context);
        tasks.push(promise);
      },
    };
    const handler = createPagesRequestHandler(async (request, env, waitUntil) => {
      assert.equal(request, context.request);
      assert.equal(env, context.env);
      waitUntil(Promise.resolve('recorded'));
      return Response.json({ ok: true });
    });

    const response = await handler(context);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(await Promise.all(tasks), ['recorded']);
  });
});

describe('Cloudflare Pages wrangler.jsonc configuration', () => {
  it('must not contain an unsupported observability block', async () => {
    const config = await readWranglerConfig();
    assert.equal(
      config.observability,
      undefined,
      'wrangler.jsonc must not contain an "observability" block — it is unsupported for Cloudflare Pages and causes wrangler CLI to exit 1',
    );
  });

  it('must retain required Pages settings (send_metrics, upload_source_maps, hyperdrive)', async () => {
    const config = await readWranglerConfig();
    assert.equal(config.send_metrics, false);
    assert.equal(config.upload_source_maps, true);
    assert.ok(Array.isArray(config.hyperdrive), 'hyperdrive binding must be present');
    assert.ok(config.hyperdrive.length > 0, 'hyperdrive must have at least one entry');
  });
});
