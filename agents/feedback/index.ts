// Why: see PROMPT.md. Works on the newest unhandled feedback note: reworks the versions it names, may
// propose a route change when the same complaint repeats, and marks the note handled. It can only touch
// versions, agent prompts and the profile; any other path in the reply is refused.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { fencedFiles, setFrontMatterField, userMessage } from '../_lib/generic.js';
import type { AgentRun, OutputFile } from '../_lib/types.js';

async function olderNotes(repo: string, skip: string): Promise<string> {
  const thoughts = await readdir(join(repo, 'thoughts')).catch(() => [] as string[]);
  const notes: string[] = [];
  for (const slug of thoughts) {
    const dir = join(repo, 'thoughts', slug, 'feedback');
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      const path = `thoughts/${slug}/feedback/${name}`;
      if (!name.endsWith('.md') || path === skip) continue;
      notes.push(`<!-- ${path} -->\n${(await readFile(join(dir, name), 'utf8')).trim()}`);
    }
  }
  return notes.join('\n\n');
}

async function prompts(repo: string): Promise<string> {
  const names = await readdir(join(repo, 'agents')).catch(() => [] as string[]);
  const parts: string[] = [];
  for (const name of names) {
    const text = await readFile(join(repo, 'agents', name, 'PROMPT.md'), 'utf8').catch(() => null);
    if (text !== null) parts.push(`<!-- agents/${name}/PROMPT.md -->\n${text.trim()}`);
  }
  return parts.join('\n\n');
}

export const run: AgentRun = async (ctx) => {
  const notes = [...ctx.thought.files.entries()]
    .filter(
      ([path, content]) => path.startsWith('feedback/') && matter(content).data['handled'] !== true,
    )
    .sort(([a], [b]) => a.localeCompare(b));
  const newest = notes.at(-1);
  if (newest === undefined)
    return { status: 'nothing-to-do', summary: 'No unhandled feedback note.', files: [] };

  const repo = resolve(ctx.thought.dir, '..', '..');
  const [notePath, note] = newest;
  const versions = Object.fromEntries(
    [...ctx.thought.files.entries()]
      .filter(([path]) => path.startsWith('versions/'))
      .map(([path, content]) => [path.replace(/[^a-z0-9]/gi, '_'), `${path}\n${content}`]),
  );
  const message = userMessage(
    {
      newest_feedback: note,
      ...versions,
      older_feedback: await olderNotes(repo, `thoughts/${ctx.thought.slug}/${notePath}`),
      agent_prompts: await prompts(repo),
    },
    `Today is ${ctx.today}. Rework as the prompt describes. Put each file in its own fenced block with its path on the first line: versions/<name>.md, agents/<name>/PROMPT.md or profile.md.`,
  );
  const reply = await ctx.ask(message, { maxOutputTokens: 16000 });

  const files: OutputFile[] = [];
  for (const block of fencedFiles(reply)) {
    const path = block.label ?? '';
    if (/^versions\/[a-z0-9-]+\.md$/.test(path)) files.push({ path, content: block.content });
    else if (/^agents\/[a-z]+\/PROMPT\.md$/.test(path) || path === 'profile.md')
      files.push({ path, content: block.content, base: 'repo' });
  }
  if (files.length === 0)
    throw new Error('the feedback agent returned no file it is allowed to write');
  files.push({ path: notePath, content: setFrontMatterField(note, 'handled', 'true') });
  return {
    status: 'done',
    summary: `Reworked after ${notePath}: ${files
      .slice(0, -1)
      .map((f) => f.path)
      .join(', ')}.`,
    files,
  };
};
