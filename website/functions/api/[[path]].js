import { handleCloudflareApiRequest } from '../../lib/cloudflare-api.mjs';

export function onRequest({ request, env }) {
  return handleCloudflareApiRequest(request, env);
}
