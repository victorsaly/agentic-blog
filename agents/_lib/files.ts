// Why: agents hand back files; only the runner touches the disk. That keeps the "never write under
// origin/" rule in one function, and makes an agent testable without a filesystem.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { assertNotOrigin, type OutputFile } from './types.js';

export async function writeOutputs(baseDir: string, files: OutputFile[]): Promise<string[]> {
  const written: string[] = [];
  for (const file of files) {
    assertNotOrigin(file.path);
    if (!hasWhy(file.content)) throw new Error(`${file.path} has no why in its front matter; refusing to write it`);
    const full = join(baseDir, file.path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, file.content.endsWith('\n') ? file.content : `${file.content}\n`, 'utf8');
    written.push(file.path);
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
