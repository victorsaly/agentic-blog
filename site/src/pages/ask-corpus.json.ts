// Why: the chat answers from the published posts, so at build time this writes them out as one file the
// Worker reads: message, idea, the long version and the raw origin of every post that is not a draft. It is
// the same text the site already shows; nothing private goes in. It also carries the one switch: the chat
// opens to everyone only when settings.yml publishing.index is on.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { Corpus } from '../lib/ask';
import { leafOf, thoughtSlugOf } from '../lib/content';
import { settings } from '../lib/settings';

// Typed at the boundary: on a fresh checkout Astro has not generated its content types yet when lint runs.
interface Entry {
  id: string;
  body?: string;
}
interface ThoughtEntry extends Entry {
  data: { title: string; message: string; draft: boolean };
}

export const GET: APIRoute = async () => {
  const thoughts = ((await getCollection('thoughts')) as unknown as ThoughtEntry[]).filter(
    (t) => !t.data.draft,
  );
  const versions = (await getCollection('versions')) as unknown as Entry[];
  const origins = (await getCollection('origins')) as unknown as Entry[];
  const corpus: Corpus = {
    open: settings.publishing.index,
    model: settings.agents.model,
    site: settings.site.domain,
    author: settings.site.author,
    posts: thoughts.map((t) => {
      const slug = thoughtSlugOf(t.id);
      const version = (leaf: string) =>
        versions.find((v) => thoughtSlugOf(v.id) === slug && leafOf(v.id) === leaf)?.body?.trim() ??
        '';
      return {
        slug,
        title: t.data.title,
        message: t.data.message,
        idea: version('short') || (t.body?.trim() ?? ''),
        road: version('long'),
        origin: origins
          .filter((o) => thoughtSlugOf(o.id) === slug && leafOf(o.id) !== 'answers')
          .map((o) => o.body?.trim() ?? '')
          .join('\n\n'),
      };
    }),
  };
  return new Response(JSON.stringify(corpus), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
