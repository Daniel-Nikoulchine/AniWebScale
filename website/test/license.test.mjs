import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { createLicenseService } from '../lib/license.mjs';

describe('signed licenses', () => {
  it('issues a verifiable fail-closed Free license', async () => {
    const service = createLicenseService({ issuer: 'https://license.example' });
    const result = await service.sign({
      userId: '3e48666a-ff39-4b8f-843d-b0cf72c490cb',
      plan: 'pro',
      status: 'past_due',
    });
    const { payload } = await jwtVerify(result.token, createLocalJWKSet(await service.jwks()), {
      issuer: 'https://license.example',
      audience: 'aniwebscale-extension',
    });
    assert.equal(result.plan, 'free');
    assert.deepEqual(payload.features, ['anime4k', 'webgpu']);
  });

  it('includes paid features only for an active paid entitlement', async () => {
    const service = createLicenseService({ issuer: 'https://license.example' });
    const result = await service.sign({
      userId: '3e48666a-ff39-4b8f-843d-b0cf72c490cb',
      plan: 'lifetime',
      status: 'active',
    });
    const { payload } = await jwtVerify(result.token, createLocalJWKSet(await service.jwks()), {
      issuer: 'https://license.example',
      audience: 'aniwebscale-extension',
    });
    assert.equal(result.plan, 'lifetime');
    assert.equal(payload.features.includes('native_renderer'), true);
    assert.equal(payload.features.includes('ai_models'), true);
    assert.equal(payload.features.includes('frame_generation'), true);
  });
});
