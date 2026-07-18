import {
  SignJWT,
  exportJWK,
  generateKeyPair,
} from 'jose';
import { createPrivateKey, createPublicKey } from 'node:crypto';

const FREE_FEATURES = Object.freeze(['anime4k', 'webgpu']);
const PRO_FEATURES = Object.freeze([
  ...FREE_FEATURES,
  'native_renderer',
  'ai_models',
  'frame_generation',
  'protected_streaming',
]);

function decodePrivateKey(value) {
  if (!value) return '';
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * @param {{issuer?: string, audience?: string, privateKeyBase64?: string}} [options]
 */
export function createLicenseService({
  issuer,
  audience = process.env.LICENSE_AUDIENCE || 'aniwebscale-extension',
  privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY_PKCS8_B64 || '',
} = {}) {
  let keyPromise;

  async function keys() {
    if (!keyPromise) {
      keyPromise = (async () => {
        const configuredPem = decodePrivateKey(privateKeyBase64);
        if (configuredPem) {
          const privateKey = createPrivateKey(configuredPem);
          const publicKey = createPublicKey(privateKey);
          const publicJwk = await exportJWK(publicKey);
          publicJwk.use = 'sig';
          publicJwk.alg = 'ES256';
          publicJwk.kid = 'aniwebscale-license-v1';
          delete publicJwk.d;
          return { privateKey, publicJwk, persistent: true };
        }

        const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
        const publicJwk = await exportJWK(publicKey);
        publicJwk.use = 'sig';
        publicJwk.alg = 'ES256';
        publicJwk.kid = 'aniwebscale-license-ephemeral';
        return { privateKey, publicJwk, persistent: false };
      })();
    }
    return keyPromise;
  }

  return {
    async jwks() {
      const { publicJwk } = await keys();
      return { keys: [publicJwk] };
    },

    async sign({ userId, plan, status, currentPeriodEnd = null }) {
      const activePaidPlan = (plan === 'pro' || plan === 'lifetime')
        && (status === 'active' || status === 'trialing');
      const effectivePlan = activePaidPlan ? plan : 'free';
      const features = activePaidPlan ? PRO_FEATURES : FREE_FEATURES;
      const { privateKey, publicJwk } = await keys();
      const token = await new SignJWT({
        plan: effectivePlan,
        status: activePaidPlan ? status : 'inactive',
        features,
        current_period_end: currentPeriodEnd,
      })
        .setProtectedHeader({ alg: 'ES256', kid: publicJwk.kid, typ: 'JWT' })
        .setSubject(userId)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime('15m')
        .setJti(crypto.randomUUID())
        .sign(privateKey);

      return {
        token,
        plan: effectivePlan,
        status: activePaidPlan ? status : 'inactive',
        features,
        expiresIn: 900,
      };
    },

    async persistentKeyConfigured() {
      return (await keys()).persistent;
    },
  };
}
