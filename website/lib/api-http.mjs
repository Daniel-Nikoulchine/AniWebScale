import { createHash, timingSafeEqual } from 'node:crypto';

const REQUEST_LIMIT = 32_768;

function requestId(request) {
  const supplied = request.headers.get('cf-ray') || request.headers.get('x-request-id') || '';
  return /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function safeErrorFields(error) {
  const errorType = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name)
    ? error.name
    : 'UnknownError';
  const candidate = typeof error?.code === 'string' ? error.code : '';
  const errorCode = /^[A-Z0-9_]{2,64}$/.test(candidate) ? candidate : undefined;
  return { errorType, ...(errorCode ? { errorCode } : {}) };
}

export function log(level, fields) {
  console[level](JSON.stringify({ service: 'aniwebscale-api', ...fields }));
}

export function requestOrigin(request) {
  return new URL(request.url).origin;
}

export function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

export function corsHeaders(request, publicUrl) {
  const origin = request.headers.get('origin') || '';
  const pathname = new URL(request.url).pathname;
  const capabilityEndpoint = pathname === '/api/extension-auth/token'
    || pathname === '/api/extension-auth/license'
    || pathname === '/api/extension-auth/revoke';
  const extensionCapabilityOrigin = capabilityEndpoint
    && (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'));
  if (origin === publicUrl || extensionCapabilityOrigin) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      Vary: 'Origin',
    };
  }
  return {};
}

export function json(request, publicUrl, status, value) {
  return Response.json(value, {
    status,
    headers: {
      ...securityHeaders(),
      ...corsHeaders(request, publicUrl),
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId(request),
    },
  });
}

export async function readBody(request, limit) {
  const declaredLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error('REQUEST_TOO_LARGE');
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('REQUEST_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseJsonBody(request) {
  const body = await readBody(request, REQUEST_LIMIT);
  return JSON.parse(new TextDecoder().decode(body) || '{}');
}

export function constantTimeEqual(left, right) {
  const leftDigest = createHash('sha256').update(String(left)).digest();
  const rightDigest = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
