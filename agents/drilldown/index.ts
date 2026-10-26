// Why: see PROMPT.md. One page per book, person, tool or project the post leans on, made once: a name that
// already has a page (under its title or another name) is skipped, and every page is checked to carry what
// the site's wiki collection asks for, and is set to wait for Victor's review, before it is written.
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import {
  IN_THE_REPLY,
  fencedFiles,
  kebab,
  readIfPresent,
  setFrontMatterField,
  userMessage,
} from '../_lib/generic.js';
import type { AgentRun, OutputFile } from '../_lib/types.js';

const MAX_WORDS = 300;

/**
 * The front matter the site's wiki collection accepts (site/src/content.config.ts), kept in step by hand: a
 * page it would refuse breaks the whole site build, reviewed or not, so it is never written.
 */
export const wikiFront = z.object({
  why: z.string().trim().min(20).max(600),
  title: z.string().min(1).max(120),
  kind: z.enum(['book', 'person', 'tool', 'project', 'other']),
  first_mentioned: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  reviewed: z.literal(false),
});

const namesOf = (data: Record<string, unknown>): string[] => {
  const aliases: unknown[] = Array.isArray(data['aliases']) ? data['aliases'] : [];
  return [data['title'], ...aliases]
    .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    .map((n) => n.trim().toLowerCase());
};

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
  // Each page's names, so "Copilot" is known to be taken when "GitHub Copilot" has a page.
  const taken = new Set<string>();
  const listed: string[] = [];
  for (const file of existing) {
    const { data } = matter(await readFile(join(wikiDir, file), 'utf8'));
    const own = namesOf(data);
    for (const n of own) taken.add(n);
    listed.push(`- ${file}: ${own.join(', ') || '(no title)'}`);
  }

  const message = userMessage(
    {
      sources,
      short_version: readIfPresent(ctx, 'versions/short.md'),
      long_version: readIfPresent(ctx, 'versions/long.md'),
      existing_pages: listed.length > 0 ? listed.join('\n') : 'none',
    },
    `Today is ${ctx.today}. The thought slug is ${ctx.thought.slug}. Write the wiki pages as the prompt describes, each in its own fenced block. If nothing the post leans on needs a page, reply with the single word NONE. ${IN_THE_REPLY}`,
  );
  const reply = await ctx.ask(message, { webSearch: { maxUses: 8 }, maxOutputTokens: 12000 });
  const { files, skipped } = pagesFrom(reply, existing, taken, ctx.thought.slug);
  const notWritten = skipped.length > 0 ? ` Not written: ${skipped.join('; ')}.` : '';
  if (files.length === 0)
    return {
      status: 'nothing-to-do',
      summary: `Nothing the post leans on needed a new page.${notWritten}`,
      files: [],
    };
  return {
    status: 'done',
    summary: `Wrote ${String(files.length)} wiki page(s): ${files.map((f) => f.path).join(', ')}. All wait for review.${notWritten}`,
    files,
  };
};

/**
 * The pages in a reply that may be written: a known kind, under 300 words, and no name another page (or an
 * earlier block) already has. Each is set to wait for review and to name this thought as its first mention.
 */
export function pagesFrom(
  reply: string,
  existing: readonly string[],
  taken: Set<string>,
  slug: string,
): { files: OutputFile[]; skipped: string[] } {
  const files: OutputFile[] = [];
  const skipped: string[] = [];
  for (const block of fencedFiles(reply)) {
    const { data, content: body } = matter(block.content);
    const title: unknown = data['title'];
    if (typeof title !== 'string' || title.trim() === '') continue;
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words >= MAX_WORDS) {
      skipped.push(`${title} (${String(words)} words, over ${String(MAX_WORDS)})`);
      continue;
    }
    // Whatever the model wrote, the page waits for Victor and names this thought as where it came from.
    let content = setFrontMatterField(block.content, 'reviewed', 'false');
    content = setFrontMatterField(content, 'first_mentioned', slug);
    if (!Array.isArray(data['aliases'])) content = setFrontMatterField(content, 'aliases', '[]');
    const front = wikiFront.safeParse(matter(content).data);
    if (!front.success) {
      const issue = front.error.issues[0];
      skipped.push(
        `${title} (${issue ? `${issue.path.join('.')}: ${issue.message}` : 'bad front matter'})`,
      );
      continue;
    }
    const name = `${kebab(title)}.md`;
    const names = namesOf(front.data);
    if (existing.includes(name) || names.some((n) => taken.has(n))) continue;
    for (const n of names) taken.add(n);
    files.push({ path: `wiki/${name}`, content, base: 'repo' });
  }
  return { files, skipped };
}
