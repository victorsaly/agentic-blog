// Why: the feed a reader follows to hear of the next thought: every published post, its title and its
// message, built with the site. The words are the same ones the site already shows.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { rssXml } from '../lib/feed';
import { thoughtSlugOf } from '../lib/content';
import { settings } from '../lib/settings';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(`https://${settings.site.domain}`);
  const thoughts = await getCollection('thoughts', ({ data }) => !data.draft);
  const xml = rssXml({
    title: settings.site.name,
    link: base.href,
    self: new URL('/rss.xml', base).href,
    description: settings.site.tagline,
    language: settings.languages.origin,
    items: thoughts.map((t) => ({
      title: t.data.title,
      link: new URL(`/thoughts/${thoughtSlugOf(t.id)}`, base).href,
      description: t.data.message.trim(),
      date: t.data.date,
    })),
  });
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
