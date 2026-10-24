// Why: building the context is the same for every agent: read settings.yml, profile.md, the agent's
// PROMPT.md and the thought folder. Doing it in one place means every agent sees exactly the same world,
// and a missing or malformed file fails before any model is called.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import { parse } from 'yaml';
import {
  promptFrontMatter,
  type AgentName,
  type Prompt,
  type Settings,
  type ThoughtFiles,
} from './types.js';

export async function loadSettings(root: string): Promise<Settings> {
  const raw = await readFile(join(root, 'settings.yml'), 'utf8');
  // settings.yml is validated by the site's zod schema at build time; here it is read as-is.
  return parse(raw) as Settings;
}

export async function loadProfile(root: string): Promise<string> {
  return readFile(join(root, 'profile.md'), 'utf8');
}

export async function loadPrompt(root: string, agent: AgentName): Promise<Prompt> {
  const raw = await readFile(join(root, 'agents', agent, 'PROMPT.md'), 'utf8');
  const { data, content } = matter(raw);
  const meta = promptFrontMatter.parse(data);
  if (meta.name !== agent)
    throw new Error(`agents/${agent}/PROMPT.md says its name is ${meta.name}`);
  return { meta, instructions: content.trim() };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
    ),
  );
  return nested.flat();
}

export async function loadThought(root: string, slug: string): Promise<ThoughtFiles> {
  const dir = join(root, 'thoughts', slug);
  const paths = (await walk(dir)).filter((p) => p.endsWith('.md'));
  const files = new Map<string, string>();
  await Promise.all(
    paths.map(async (p) => {
      files.set(relative(dir, p), await readFile(p, 'utf8'));
    }),
  );
  if (files.size === 0) throw new Error(`thoughts/${slug} has no Markdown files`);
  return { slug, dir, files };
}

/** Every file under the thought's origin folder, Markdown or not, relative to the thought. */
export async function originFiles(dir: string): Promise<string[]> {
  try {
    return (await walk(join(dir, 'origin'))).map((p) => relative(dir, p));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** The system message every agent runs under: who is talking, then what this agent does. */
export function systemMessage(profile: string, prompt: Prompt, settings: Settings): string {
  return [
    `You are one agent of the agentic blog for ${settings.site.name} (${settings.site.domain}).`,
    'You convert; you never invent what the person did not say. Every file you produce starts with a why.',
    '',
    '# The blogger',
    profile.trim(),
    '',
    `# Your job: ${prompt.meta.name}`,
    `Why this agent exists: ${prompt.meta.why.trim()}`,
    '',
    prompt.instructions,
  ].join('\n');
}
