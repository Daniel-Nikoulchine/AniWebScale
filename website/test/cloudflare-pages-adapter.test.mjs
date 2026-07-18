import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPagesRequestHandler } from '../functions/api/[[path]].js';

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
