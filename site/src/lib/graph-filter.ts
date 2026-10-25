// Why: on /graph a reader can type a word and see only the small ideas that say it, in the picture and in
// the list, with the matching words marked as search marks them. These pure functions decide what matches
// and which words to mark, with the same stemming the rest of the site uses to match words, so "picture"
// finds "pictures" and "pict" finds both. Tested without a page.
import { wordsOf } from './idea-sections';

export interface FilterIdea {
  id: string;
  text: string;
}

/** The words of a query that can match anything; a query of stop words alone asks for nothing. */
export function termsOf(query: string): string[] {
  return [...new Set(wordsOf(query))];
}

const begins = (word: string, terms: readonly string[]): boolean =>
  terms.some((t) => word.startsWith(t));

/** The ideas every term begins a word of. */
export function matchingIdeas(terms: readonly string[], ideas: readonly FilterIdea[]): Set<string> {
  if (terms.length === 0) return new Set(ideas.map((i) => i.id));
  const hits = new Set<string>();
  for (const idea of ideas) {
    const words = wordsOf(idea.text);
    if (terms.every((t) => words.some((w) => w.startsWith(t)))) hits.add(idea.id);
  }
  return hits;
}

export interface Segment {
  text: string;
  hit: boolean;
}

/** The text cut into runs, each marked when its word begins with a term, with its spaces and marks kept. */
export function segmentsOf(text: string, terms: readonly string[]): Segment[] {
  if (terms.length === 0) return [{ text, hit: false }];
  const segments: Segment[] = [];
  for (const piece of text.split(/(\s+)/)) {
    if (piece === '') continue;
    const [stem] = wordsOf(piece);
    const hit = stem !== undefined && begins(stem, terms);
    const last = segments.at(-1);
    if (last?.hit === hit) last.text += piece;
    else segments.push({ text: piece, hit });
  }
  return segments;
}
