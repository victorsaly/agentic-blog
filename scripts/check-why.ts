// Why: the rule "everything here has a why" is only real if a missing why fails the build.
// This walks thoughts/, wiki/ and agents/, parses each Markdown file's front matter and refuses anything
// without a why, an origin that claims to have been edited, or a published thought without its own number.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import matter from 'gray-matter';
import {
  genericFrontMatter,
  originFrontMatter,
  structureFrontMatter,
  versionFrontMatter,
} from './content-schema.js';

const ROOTS = ['thoughts', 'wiki', 'agents', 'profile.md'] as const;

export interface Problem {
  file: string;
  message: string;
}

/** Recursively lists Markdown files under a path (a file path is returned as-is). */
export async function listMarkdown(path: string): Promise<string[]> {
  if (path.endsWith('.md')) return [path];
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = join(path, entry.name);
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) return Promise.resolve([]);
      if (entry.isDirectory()) return listMarkdown(full);
      return entry.isFile() && entry.name.endsWith('.md')
        ? Promise.resolve([full])
        : Promise.resolve([]);
    }),
  );
  return nested.flat();
}

function schemaFor(file: string) {
  const parts = file.split(sep);
  if (parts.includes('origin')) return originFrontMatter;
  if (parts.includes('versions')) return versionFrontMatter;
  if (parts.at(-1) === 'structure.md') return structureFrontMatter;
  return genericFrontMatter;
}

/** Checks one file's front matter; returns the problems found (empty means fine). */
export function checkFrontMatter(file: string, source: string): Problem[] {
  const { data } = matter(source);
  const result = schemaFor(file).safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    file,
    message: `${issue.path.join('.') || 'front matter'}: ${issue.message}`,
  }));
}

/**
 * A thought's number sits beside its title on every list, so it is written in its front matter once, when
 * the thought is published, and nothing a later post does can move it. Refuses a published thought without
 * one and two thoughts that share one, and says which number is free.
 */
export function checkNumbers(thoughts: { file: string; data: unknown }[]): Problem[] {
  const parsed = thoughts.flatMap(({ file, data }) => {
    const result = structureFrontMatter.safeParse(data);
    return result.success ? [{ file, ...result.data }] : [];
  });
  const free = String(Math.max(0, ...parsed.map((t) => t.number ?? 0)) + 1);
  const owners = new Map<number, string>();
  const problems: Problem[] = [];
  for (const t of parsed) {
    if (t.number === undefined) {
      if (!t.draft) {
        problems.push({
          file: t.file,
          message: `number: a published thought needs a number; the next free one is ${free}`,
        });
      }
      continue;
    }
    const owner = owners.get(t.number);
    if (owner === undefined) owners.set(t.number, t.file);
    else {
      problems.push({
        file: t.file,
        message: `number: ${String(t.number)} is already ${owner}'s; the next free one is ${free}`,
      });
    }
  }
  return problems;
}

export async function checkAll(root = process.cwd()): Promise<Problem[]> {
  const files = (await Promise.all(ROOTS.map((r) => listMarkdown(join(root, r))))).flat();
  const sources = await Promise.all(
    files.map(async (file) => ({
      file: relative(root, file),
      source: await readFile(file, 'utf8'),
    })),
  );
  const structures = sources
    .filter(({ file }) => file.split(sep).at(-1) === 'structure.md')
    .map(({ file, source }) => ({ file, data: matter(source).data }));
  return [
    ...sources.flatMap(({ file, source }) => checkFrontMatter(file, source)),
    ...checkNumbers(structures),
  ];
}

const isMain = process.argv[1]?.endsWith('check-why.ts') ?? false;
if (isMain) {
  const problems = await checkAll();
  if (problems.length === 0) {
    console.info('check:why — every file says why it exists.');
  } else {
    for (const p of problems) {
      console.error(`${p.file}: ${p.message}`);
      // GitHub Actions turns this into an annotation on the file, readable without the raw log.
      if (process.env['GITHUB_ACTIONS']) console.error(`::error file=${p.file}::${p.message}`);
    }
    console.error(
      `\n${String(problems.length)} problem(s) in front matter. Each line above says what to fix.`,
    );
    process.exitCode = 1;
  }
}
