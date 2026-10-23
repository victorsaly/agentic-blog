// Why: agents hand back files; only the runner touches the disk. That keeps the "never write under
// origin/" rule in one function, and makes an agent testable without a filesystem.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { assertNotOrigin, type OutputFile } from './types.js';

export interface Bases {
  thought: string;
  repo: string;
  /** Where a file goes when it does not say. */
  fallback: 'thought' | 'repo';
}

export async function writeOutputs(bases: Bases, files: OutputFile[]): Promise<string[]> {
  const written: string[] = [];
  for (const file of files) {
    assertNotOrigin(file.path);
    if (file.path.split('/').includes('..'))
      throw new Error(`refusing to write ${file.path}: paths stay inside their base`);
    const base = file.base ?? bases.fallback;
    const full = join(bases[base], file.path);
    if (file.remove === true) {
      await rm(full, { force: true });
      written.push(`removed ${base === bases.fallback ? file.path : `${base}:${file.path}`}`);
      continue;
    }
    await mkdir(dirname(full), { recursive: true });
    if (file.bytes !== undefined) {
      if (file.path.endsWith('.md'))
        throw new Error(`${file.path} is Markdown and must be text with a why, not bytes`);
      await writeFile(full, file.bytes);
    } else {
      if (!hasWhy(file.content))
        throw new Error(`${file.path} has no why in its front matter; refusing to write it`);
      await writeFile(
        full,
        file.content.endsWith('\n') ? file.content : `${file.content}\n`,
        'utf8',
      );
    }
    written.push(base === bases.fallback ? file.path : `${base}:${file.path}`);
  }
  return written;
}

export function hasWhy(markdown: string): boolean {
  const { data } = matter(markdown);
  const why: unknown = data['why'];
  return typeof why === 'string' && why.trim().length >= 20;
}

/** Builds a Markdown file from front matter and a body, in the order the repo expects: why first. */
export function markdownFile(frontMatter: Record<string, unknown>, body: string): string {
  const ordered: Record<string, unknown> = {};
  if ('why' in frontMatter) ordered['why'] = frontMatter['why'];
  for (const [key, value] of Object.entries(frontMatter)) if (key !== 'why') ordered[key] = value;
  return matter.stringify(`\n${body.trim()}\n`, ordered);
}
