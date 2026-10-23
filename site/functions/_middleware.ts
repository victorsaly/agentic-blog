// Why: every /api/* call must come through Cloudflare Access, except in local dev. The site is static;
// only the functions can write anything, so this is the one gate that matters.
import { cameThroughAccess, problem, type Env } from './_lib';

export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  const url = new URL(request.url);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.pathname.startsWith('/api/') && !local && !cameThroughAccess(request)) {
    return problem('This endpoint is only reachable through Cloudflare Access.', 401);
  }
  return next();
};
