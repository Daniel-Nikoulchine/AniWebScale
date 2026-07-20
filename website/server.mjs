import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createApiRuntime } from './lib/cloudflare-api.mjs';
import { isAuthUrl } from './lib/config.mjs';
import { normalizeRequestAddress } from './lib/rate-limit.mjs';

const root = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const lucideFontRoot = resolve(fileURLToPath(new URL('./node_modules/lucide-static/font/', import.meta.url)));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const vendorFiles = Object.freeze({
  '/vendor/lucide/lucide.css': join(lucideFontRoot, 'lucide.css'),
  '/vendor/lucide/lucide.woff2': join(lucideFontRoot, 'lucide.woff2'),
});

function websiteConfiguration(env) {
  const port = Number.parseInt(env.PORT || '4242', 10);
  const publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
  const authBaseUrl = isAuthUrl(env.NEON_AUTH_URL) ? env.NEON_AUTH_URL : '';
  const authOrigin = authBaseUrl ? new URL(authBaseUrl).origin : '';
  const connectSources = ["'self'", authOrigin].filter(Boolean).join(' ');
  return {
    port,
    publicUrl,
    securityHeaders: Object.freeze({
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src ${connectSources}; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; upgrade-insecure-requests`,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
    }),
  };
}

function safeErrorFields(error) {
  const errorType = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name)
    ? error.name
    : 'UnknownError';
  const candidate = typeof error?.code === 'string' ? error.code : '';
  const errorCode = /^[A-Z0-9_]{2,64}$/.test(candidate) ? candidate : undefined;
  return { errorType, ...(errorCode ? { errorCode } : {}) };
}

function logFailure(event, error) {
  console.error(JSON.stringify({ service: 'aniwebscale-website', event, ...safeErrorFields(error) }));
}

function requestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

function toFetchRequest(request, publicUrl, requestAddresses) {
  const method = request.method || 'GET';
  const init = { method, headers: requestHeaders(request) };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = Readable.toWeb(request);
    init.duplex = 'half';
  }
  const fetchRequest = new Request(new URL(request.url || '/', publicUrl), init);
  requestAddresses.set(fetchRequest, normalizeRequestAddress(request.socket.remoteAddress));
  return fetchRequest;
}

async function sendFetchResponse(response, fetchResponse) {
  const headers = {};
  for (const [name, value] of fetchResponse.headers) headers[name] = value;
  response.writeHead(fetchResponse.status, headers);
  if (!fetchResponse.body) return response.end();
  const body = Readable.fromWeb(fetchResponse.body);
  body.on('error', error => response.destroy(error));
  body.pipe(response);
}

function sendUnexpected(response, securityHeaders) {
  response.writeHead(500, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify({ error: 'Unexpected server error.' }));
}

async function serveStatic(url, response, securityHeaders) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const normalized = normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = resolve(join(root, normalized));
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403, securityHeaders);
    return response.end('Forbidden');
  }
  try {
    let servedPath = filePath;
    let info;
    try {
      info = await stat(servedPath);
    } catch (error) {
      if (extname(servedPath)) throw error;
      servedPath = `${servedPath}.html`;
      info = await stat(servedPath);
    }
    if (!info.isFile()) throw new Error('NOT_FILE');
    const content = await readFile(servedPath);
    const cache = extname(servedPath) === '.html' ? 'no-cache' : 'public, max-age=3600';
    response.writeHead(200, {
      ...securityHeaders,
      'Content-Type': mimeTypes[extname(servedPath)] || 'application/octet-stream',
      'Cache-Control': cache,
    });
    response.end(content);
  } catch {
    const fallback = await readFile(join(root, '404.html'));
    response.writeHead(404, {
      ...securityHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    response.end(fallback);
  }
}

async function serveVendor(pathname, response, securityHeaders) {
  const filePath = vendorFiles[pathname];
  if (!filePath) return false;
  const content = await readFile(filePath);
  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  });
  response.end(content);
  return true;
}

/**
 * @param {{
 *   env?: Record<string, any>,
 *   runtime?: ReturnType<typeof createApiRuntime>,
 * }} [options]
 */
export function createWebsiteApp({ env = {}, runtime } = {}) {
  const { port, publicUrl, securityHeaders } = websiteConfiguration(env);
  const requestAddresses = new WeakMap();
  const apiRuntime = runtime || createApiRuntime(env, {
    fallbackOrigin: publicUrl,
    runtimeName: 'node-http',
    stripeAppName: 'AniWebScale Website',
    addressForRequest: request => requestAddresses.get(request) || 'unknown',
  });
  const backgroundTasks = new Set();
  const waitUntil = promise => {
    const tracked = Promise.resolve(promise).catch(error => {
      logFailure('background_task_failed', error);
    });
    backgroundTasks.add(tracked);
    void tracked.finally(() => backgroundTasks.delete(tracked));
  };
  const drainBackgroundTasks = async () => {
    await Promise.allSettled([...backgroundTasks]);
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', publicUrl);
    try {
      if (url.pathname.startsWith('/api/')) {
        return await sendFetchResponse(
          response,
          await apiRuntime.handle(toFetchRequest(request, publicUrl, requestAddresses), waitUntil),
        );
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { ...securityHeaders, Allow: 'GET, HEAD' });
        return response.end('Method not allowed.');
      }
      if (await serveVendor(url.pathname, response, securityHeaders)) return;
      return await serveStatic(url, response, securityHeaders);
    } catch (error) {
      logFailure('unhandled_website_request', error);
      if (!response.headersSent) sendUnexpected(response, securityHeaders);
      else response.destroy();
    }
  });
  return { server, apiRuntime, drainBackgroundTasks, port, publicUrl };
}

export function createWebsiteServer(options) {
  return createWebsiteApp(options).server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await import('dotenv/config');
  const {
    server: websiteServer,
    apiRuntime,
    drainBackgroundTasks,
    port,
    publicUrl,
  } = createWebsiteApp({ env: process.env });
  websiteServer.listen(port, () => {
    console.log(`AniWebScale website running at ${publicUrl}`);
    if (!apiRuntime.fulfillmentReady()) {
      console.log('Paid checkout remains fail-closed until Stripe, Neon, webhook, and license signing settings are complete.');
    }
  });

  let shuttingDown = false;
  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; closing the website server.`);
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    websiteServer.close(async error => {
      await drainBackgroundTasks();
      await apiRuntime.close().catch(closeError => {
        console.error('Database shutdown failed:', closeError instanceof Error ? closeError.name : 'UnknownError');
      });
      clearTimeout(deadline);
      process.exit(error ? 1 : 0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}
