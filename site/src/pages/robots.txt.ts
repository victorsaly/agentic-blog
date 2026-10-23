// Why: private by default, public by decision. One setting in settings.yml decides whether crawlers are
// welcome; the studio and the API are never for them either way.
import type { APIRoute } from 'astro';
import { settings } from '../lib/settings';

export const GET: APIRoute = () => {
  const lines = settings.publishing.index
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /studio',
        'Disallow: /api/',
        `Sitemap: https://${settings.site.domain}/sitemap-index.xml`,
      ]
    : ['User-agent: *', 'Disallow: /'];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
