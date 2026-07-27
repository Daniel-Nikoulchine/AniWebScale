import {
  createHash,
  createHmac,
} from 'node:crypto';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return createHmac('sha256', key).update(value).digest();
}

function encodedPath(value) {
  return value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export function createS3Request({
  method,
  endpoint,
  bucket,
  key,
  region = 'auto',
  accessKeyId,
  secretAccessKey,
  payload = Buffer.alloc(0),
  now = new Date(),
}) {
  const base = new URL(endpoint);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('Secondary S3 endpoint must be a credential-free HTTPS URL.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/.test(bucket || '')) {
    throw new Error('Secondary S3 bucket is invalid.');
  }
  if (!key || key.startsWith('/') || key.includes('..')) throw new Error('Secondary S3 object key is invalid.');
  if (!accessKeyId || !secretAccessKey) throw new Error('Secondary S3 credentials are missing.');

  const prefix = base.pathname === '/' ? '' : base.pathname.replace(/\/$/, '');
  const canonicalUri = `${prefix}/${encodeURIComponent(bucket)}/${encodedPath(key)}`;
  const url = new URL(canonicalUri, base.origin);
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.slice(0, 8);
  const payloadHash = sha256(payload);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return {
    url,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': timestamp,
    },
  };
}

export async function uploadEncryptedBackup({
  endpoint,
  bucket,
  key,
  region,
  accessKeyId,
  secretAccessKey,
  payload,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const input = { endpoint, bucket, key, region, accessKeyId, secretAccessKey, now };
  const put = createS3Request({ ...input, method: 'PUT', payload });
  const putResponse = await fetchImpl(put.url, {
    method: 'PUT',
    headers: put.headers,
    body: payload,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!putResponse.ok) throw new Error(`Secondary backup upload failed with HTTP ${putResponse.status}.`);

  const head = createS3Request({ ...input, method: 'HEAD' });
  const headResponse = await fetchImpl(head.url, {
    method: 'HEAD',
    headers: head.headers,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!headResponse.ok) throw new Error(`Secondary backup verification failed with HTTP ${headResponse.status}.`);
  const storedLength = Number.parseInt(headResponse.headers.get('content-length') || '', 10);
  if (Number.isFinite(storedLength) && storedLength !== payload.length) {
    throw new Error('Secondary backup verification returned a different object size.');
  }
  return { objectKey: key, bytes: payload.length };
}

export async function downloadEncryptedBackup({
  endpoint,
  bucket,
  key,
  region,
  accessKeyId,
  secretAccessKey,
  fetchImpl = fetch,
  now = new Date(),
  maximumBytes = 1024 * 1024 * 1024,
}) {
  const request = createS3Request({
    method: 'GET', endpoint, bucket, key, region, accessKeyId, secretAccessKey, now,
  });
  const response = await fetchImpl(request.url, {
    method: 'GET',
    headers: request.headers,
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Secondary backup download failed with HTTP ${response.status}.`);
  const declaredLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(declaredLength) && (declaredLength < 0 || declaredLength > maximumBytes)) {
    throw new Error('Secondary backup download exceeds the configured size limit.');
  }
  const payload = Buffer.from(await response.arrayBuffer());
  if (payload.length > maximumBytes) throw new Error('Secondary backup download exceeds the configured size limit.');
  if (Number.isFinite(declaredLength) && payload.length !== declaredLength) {
    throw new Error('Secondary backup download returned a different object size.');
  }
  return { objectKey: key, payload, bytes: payload.length };
}
