// Why: the chat answers from the published posts, so at build time this writes them out as one file the
// Worker reads: message, idea, the long version and the raw origin of every post that is not a draft. It is
// the same text the site already shows; nothing private goes in. Each post also lists its places, the ways in
// and every section heading with its address, so an answer can send the reader to the exact spot. It also
// carries the one switch: the chat opens to everyone only when settings.yml publishing.index is on.
import type { APIRoute } from 'astro';
import { getCollection, render } from 'astro:content';
import type { Corpus, Place } from '../lib/ask';
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
interface Heading {
  depth: number;
  slug: string;
  text: string;
}

const headingsOf = async (entry: Entry | undefined, depth: number): Promise<Heading[]> =>
  entry
    ? ((await render(entry as Parameters<typeof render>[0])).headings as Heading[]).filter(
        (h) => h.depth === depth,
      )
    : [];

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
    posts: await Promise.all(
      thoughts.map(async (t) => {
        const slug = thoughtSlugOf(t.id);
        const entry = (leaf: string) =>
          versions.find((v) => thoughtSlugOf(v.id) === slug && leafOf(v.id) === leaf);
        const own = origins.filter(
          (o) => thoughtSlugOf(o.id) === slug && leafOf(o.id) !== 'answers',
        );
        const short = entry('short')?.body?.trim() ?? '';
        const road = entry('long')?.body?.trim() ?? '';
        const base = `/thoughts/${slug}`;
        const roadSections = await headingsOf(entry('long'), 2);
        const notes = (await Promise.all(own.map((o) => headingsOf(o, 1)))).flat();
        let n = 0;
        const places: Place[] = [
          { href: `${base}#idea`, name: 'The idea, on one screen' },
          ...(road ? [{ href: `${base}#road`, name: 'The road, the whole piece' }] : []),
          // Numbered as the page numbers them: the notes on what changed stand outside the count.
          ...roadSections.map((h) => {
            const counted = !/^what changed/i.test(h.text);
            if (counted) n += 1;
            return {
              href: `${base}#${h.slug}`,
              name: counted ? `The road, section ${String(n)}: ${h.text}` : `The road: ${h.text}`,
            };
          }),
          ...notes.map((h) => ({
            href: `${base}/origin#${h.slug}`,
            name: `The origin, ${h.text.replace(/^origin\s+(\d+)\s*[—–-]\s*/i, 'note $1: ')}`,
          })),
        ];
        return {
          slug,
          title: t.data.title,
          message: t.data.message,
          idea: short || (t.body?.trim() ?? ''),
          road,
          origin: own.map((o) => o.body?.trim() ?? '').join('\n\n'),
          places,
        };
      }),
    ),
  };
  return new Response(JSON.stringify(corpus), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
