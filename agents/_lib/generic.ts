// Why: most agents are "read these files, ask once, write that file". This keeps each agent's index.ts to
// the parts that are actually different: which inputs, which prompt, which output path.
import matter from 'gray-matter';
import { unfence } from './claude.js';
import type { AgentContext, AgentResult, AskOptions, OutputFile } from './types.js';

export function readOrThrow(ctx: AgentContext, path: string): string {
  const content = ctx.thought.files.get(path);
  if (content === undefined)
    throw new Error(`thoughts/${ctx.thought.slug}/${path} is missing; ${ctx.agent} needs it`);
  return content;
}

export function readIfPresent(ctx: AgentContext, path: string): string | undefined {
  return ctx.thought.files.get(path);
}

/** Why a guard has not passed the thought, or null when its verdict is `pass`. */
export function verdictProblem(
  ctx: AgentContext,
  name: 'safety.md' | 'security.md',
): string | null {
  const file = readIfPresent(ctx, name);
  if (file === undefined) return `${name} is missing; run that agent first.`;
  const verdict: unknown = matter(file).data['verdict'];
  return verdict === 'pass' ? null : `${name} says ${String(verdict)}.`;
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
  options?: AskOptions,
): Promise<OutputFile> {
  const reply = await ctx.ask(message, options);
  const content = fileFromReply(reply);
  if (content === null) throw new Error(`${ctx.agent} replied without front matter for ${path}`);
  return { path, content };
}

/**
 * The file inside a reply. Models sometimes say a sentence before the file, or fence it, or both; the file
 * is whatever starts at the first front matter that opens with a why. Null when there is none.
 */
export function fileFromReply(reply: string): string | null {
  for (const candidate of [unfence(reply), reply]) {
    // The front matter normally opens a line; a reply glued together without a line break still counts.
    const start = candidate.search(/^---\r?\nwhy:|(?<!-)---\r?\nwhy:/m);
    if (start >= 0) return candidate.slice(start).trim();
  }
  return null;
}

export interface FencedFile {
  /** The fence's label (```pr) or the path on the block's first line, when there is one. */
  label: string | null;
  content: string;
}

/**
 * Every fenced block in a reply, in order. An agent that returns several files puts each in its own
 * block; a first line that looks like a path (no spaces, ends in .md) is taken as the label and removed.
 */
export function fencedFiles(reply: string): FencedFile[] {
  const blocks: FencedFile[] = [];
  const fence = /^(`{3,})([^\n`]*)\n([\s\S]*?)^\1[ \t]*$/gm;
  for (const match of reply.matchAll(fence)) {
    const info = (match[2] ?? '').trim();
    let body = match[3] ?? '';
    let label: string | null =
      info !== '' && !/^(markdown|md|yaml|text)$/i.test(info) ? info : null;
    const firstLine = body.split('\n', 1)[0]?.trim() ?? '';
    if (/^[^\s]+\.md$/.test(firstLine) && !firstLine.startsWith('---')) {
      label = firstLine;
      body = body.slice(body.indexOf('\n') + 1);
    }
    blocks.push({ label, content: body.trim() });
  }
  return blocks;
}

/** A short, safe file name from a title: lower case, ascii letters and digits, hyphens. */
export function kebab(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** The last line of every social version: the badge, then the link back to the thought. */
export function badgeLine(ctx: AgentContext): string {
  return `${ctx.settings.publishing.badge_text} · https://${ctx.settings.site.domain}/thoughts/${ctx.thought.slug}`;
}

/**
 * Ends a version with exactly one badge line. Trailing lines that already mention the site (a footer
 * the model wrote itself) are replaced, so the badge is never doubled or reworded.
 */
export function withBadge(content: string, badge: string, domain: string): string {
  const lines = content.trimEnd().split('\n');
  while (lines.length > 0) {
    const last = lines.at(-1)?.trim() ?? '';
    if (last === '' || last.includes(domain)) lines.pop();
    else break;
  }
  return `${lines.join('\n')}\n\n${badge}\n`;
}

export function notImplemented(ctx: AgentContext): AgentResult {
  return {
    status: 'not-implemented',
    summary: `${ctx.agent} is planned for phase ${String(ctx.prompt.meta.phase)}; its PROMPT.md says what it will do.`,
    files: [],
  };
}
