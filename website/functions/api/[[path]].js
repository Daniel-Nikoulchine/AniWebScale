import { handleCloudflareApiRequest } from '../../lib/cloudflare-api.mjs';

export function createPagesRequestHandler(handleRequest = handleCloudflareApiRequest) {
  return function pagesRequestHandler(context) {
    return handleRequest(
      context.request,
      context.env,
      promise => context.waitUntil(promise),
    );
  };
}

export const onRequest = createPagesRequestHandler();
