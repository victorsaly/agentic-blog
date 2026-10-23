// Why: most agents are "read these files, ask once, write that file". This keeps each agent's index.ts to
// the parts that are actually different: which inputs, which prompt, which output path.
import { unfence } from './claude.js';
import type { AgentContext, AgentResult, OutputFile } from './types.js';

export function readOrThrow(ctx: AgentContext, path: string): string {
  const content = ctx.thought.files.get(path);
  if (content === undefined)
    throw new Error(`thoughts/${ctx.thought.slug}/${path} is missing; ${ctx.agent} needs it`);
  return content;
}

export function readIfPresent(ctx: AgentContext, path: string): string | undefined {
  return ctx.thought.files.get(path);
}

/**
 * Every origin file for the thought, in name order, each headed by its path: voice transcripts and text
 * alike, and a second note as well as the first. answers.md is the blogger replying to the interview, so
 * agents read it separately. Throws when the thought has no origin at all.
 */
export function readOrigin(ctx: AgentContext): string {
  const parts = [...ctx.thought.files.entries()]
    .filter(([path]) => /^origin\/[^/]+\.md$/.test(path) && path !== 'origin/answers.md')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => `<!-- ${path} -->\n${content.trim()}`);
  if (parts.length === 0)
    throw new Error(
      `thoughts/${ctx.thought.slug}/origin/ has no origin file; ${ctx.agent} needs one`,
    );
  return parts.join('\n\n');
}

/** Builds the user message: named sections, each the content of one file, then the task. */
export function userMessage(sections: Record<string, string | undefined>, task: string): string {
  const parts = Object.entries(sections)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([name, content]) => `<${name}>\n${content.trim()}\n</${name}>`);
  return [...parts, '', task.trim()].join('\n\n');
}

/** Asks once and expects the whole reply to be one Markdown file with front matter. */
export async function askForFile(
  ctx: AgentContext,
  message: string,
  path: string,
): Promise<OutputFile> {
  const reply = await ctx.ask(message);
  const content = unfence(reply);
  if (!content.startsWith('---'))
    throw new Error(`${ctx.agent} replied without front matter for ${path}`);
  return { path, content };
}

export function notImplemented(ctx: AgentContext): AgentResult {
  return {
    status: 'not-implemented',
    summary: `${ctx.agent} is planned for phase ${String(ctx.prompt.meta.phase)}; its PROMPT.md says what it will do.`,
    files: [],
  };
}
