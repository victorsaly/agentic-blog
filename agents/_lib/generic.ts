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
export function originPaths(ctx: AgentContext): string[] {
  return [...ctx.thought.files.keys()]
    .filter((path) => /^origin\/[^/]+\.md$/.test(path) && path !== 'origin/answers.md')
    .sort((a, b) => a.localeCompare(b));
}

export function readOrigin(ctx: AgentContext): string {
  const parts = originPaths(ctx).map(
    (path) => `<!-- ${path} -->\n${(ctx.thought.files.get(path) ?? '').trim()}`,
  );
  if (parts.length === 0)
    throw new Error(
      `thoughts/${ctx.thought.slug}/origin/ has no origin file; ${ctx.agent} needs one`,
    );
  return parts.join('\n\n');
}

/**
 * Sets one top-level front matter field to a value the code knows, so a fact like which file a version
 * came from never depends on the model copying it right. Adds the field if the model left it out.
 */
export function setFrontMatterField(content: string, field: string, value: string): string {
  const end = content.indexOf('\n---', 3);
  if (!content.startsWith('---') || end === -1) return content;
  const head = content.slice(0, end);
  const line = new RegExp(`^${field}:.*$`, 'm');
  const next = line.test(head)
    ? head.replace(line, `${field}: ${value}`)
    : `${head}\n${field}: ${value}`;
  return next + content.slice(end);
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
