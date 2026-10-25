// Why: see PROMPT.md. One page per book or person the post leans on, made once: a name that already has a
// page is skipped, and every page is checked to carry a title and a why before it is written.
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { IN_THE_REPLY, fencedFiles, kebab, readIfPresent, userMessage } from '../_lib/generic.js';
import type { AgentRun, OutputFile } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  const sources = readIfPresent(ctx, 'sources.md');
  if (sources === undefined)
    return {
      status: 'nothing-to-do',
      summary: 'No sources.md yet; run the citations agent first.',
      files: [],
    };
  const wikiDir = join(resolve(ctx.thought.dir, '..', '..'), 'wiki');
  const existing = (await readdir(wikiDir).catch(() => [] as string[])).filter(
    (name) => name.endsWith('.md') && name !== 'README.md',
  );

  const message = userMessage(
    {
      sources,
      long_version: readIfPresent(ctx, 'versions/long.md'),
      existing_pages: existing.length > 0 ? existing.join('\n') : 'none',
    },
    `Today is ${ctx.today}. The thought slug is ${ctx.thought.slug}. Write the wiki pages as the prompt describes, each in its own fenced block. If no book or person needs a page, reply with the single word NONE. ${IN_THE_REPLY}`,
  );
  const reply = await ctx.ask(message, { webSearch: { maxUses: 8 }, maxOutputTokens: 12000 });

  const files: OutputFile[] = [];
  for (const block of fencedFiles(reply)) {
    const { data } = matter(block.content);
    const title: unknown = data['title'];
    if (typeof title !== 'string' || title.trim() === '') continue;
    const name = `${kebab(title)}.md`;
    if (existing.includes(name)) continue;
    files.push({ path: `wiki/${name}`, content: block.content, base: 'repo' });
  }
  if (files.length === 0)
    return { status: 'nothing-to-do', summary: 'No book or person needed a new page.', files: [] };
  return {
    status: 'done',
    summary: `Wrote ${String(files.length)} wiki page(s): ${files.map((f) => f.path).join(', ')}. All unreviewed.`,
    files,
  };
};
