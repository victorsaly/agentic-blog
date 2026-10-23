// Why: every /api/* call must come through Cloudflare Access, except in local dev. The site is static;
// only the functions can write anything, so this is the one gate that matters. The hostname cannot tell
// local from production, because wrangler dev rewrites every request to the custom domain, so local dev
// announces itself with a variable that lives only in .dev.vars.
import { cameThroughAccess, problem, type Env } from './_lib';

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  const local = env.DEV_SKIP_ACCESS === '1';
  if (url.pathname.startsWith('/api/') && !local && !cameThroughAccess(request)) {
    return problem('This endpoint is only reachable through Cloudflare Access.', 401);
  }
  return next();
};
