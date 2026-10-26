// Why: the drill-down agent writes a short page in wiki/ for each book, person, tool or project a post leans
// on. These plain functions decide what a reader is told about a page (what kind of thing it is, which posts
// name it, the one line under its name), so the wiki's index and its pages say the same thing and can be
// tested without a build.
import { excerpt } from './content';

export const WIKI_KINDS = ['book', 'person', 'tool', 'project', 'other'] as const;
export type WikiKind = (typeof WIKI_KINDS)[number];

const KIND_LABELS: Record<WikiKind, string> = {
  book: 'Book',
  person: 'Person',
  tool: 'Tool',
  project: 'Project',
  other: 'Other',
};

export function kindLabel(kind: WikiKind): string {
  return KIND_LABELS[kind];
}

export function pagesLabel(count: number): string {
  return count === 1 ? 'One page' : `${String(count)} pages`;
}

const plain = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Whether a post's text names the page: its title or one of its other names, as whole words, ignoring case
 * and punctuation. "Claude" does not match "Claudette".
 */
export function mentions(text: string, names: readonly string[]): boolean {
  const haystack = ` ${plain(text)} `;
  return names.some((name) => {
    const needle = plain(name);
    return needle !== '' && haystack.includes(` ${needle} `);
  });
}

/** The page's opening words, for the line under its name on the index (or, shorter, a link preview). */
export function summaryOf(body: string, words = 28): string {
  return excerpt(body.replace(/^#{1,6}\s.*$/gm, ''), words);
}

/** A to Z by title, the way a reader looks something up. */
export function byTitle<T extends { data: { title: string } }>(a: T, b: T): number {
  return a.data.title.localeCompare(b.data.title, 'en', { sensitivity: 'base' });
}
