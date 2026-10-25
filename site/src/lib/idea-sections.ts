// Why: a small idea on the graph should take the reader to the paragraph that says it, not to the top of a
// long post. Nobody wrote down which section holds which idea, so this works it out from the words: the
// idea's words and phrases against each section's heading and text. A wrong section is worse than none, so
// when no section is clearly ahead the reader goes to the start of the whole piece instead.

export interface Section {
  /** The heading's address on the post page. */
  slug: string;
  heading: string;
  body: string;
}

// Words that say nothing about which section an idea comes from.
const stop = new Set(
  (
    'a an the and or but of to in on for with as at by from is are be it its this that we our you your i my ' +
    'me so than then there their they them what when who how all one more most can will just like into ' +
    'about also do does out up very has have was were been being should would could only even every each own same'
  ).split(' '),
);

const stem = (w: string): string =>
  w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w.replace(/s$/, '');

/** The words that carry meaning, lightly stemmed, in order: "Agents that ask" → ["agent", "ask"]. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !stop.has(w))
    .map(stem);
}

const pairsOf = (words: string[]): string[] =>
  words.slice(1).map((w, i) => `${words[i] ?? ''} ${w}`);
const countOf = (xs: string[], x: string): number => xs.filter((y) => y === x).length;

/** How far the best section must be ahead of the next, as a share of its score, to be trusted. */
export const clearLead = 0.35;
/** A best score lower than this is a guess, however far ahead. */
export const enough = 12;

/**
 * The section of a post that says a small idea, or undefined when none is clearly the one. A word or a
 * phrase counts more in a heading than in the text, more when few sections use it, and a phrase (two words
 * side by side) counts double; a section whose heading the idea mostly repeats counts up to twice.
 */
export function sectionFor(idea: string, sections: readonly Section[]): Section | undefined {
  const parsed = sections.map((s) => {
    const head = wordsOf(s.heading);
    const body = wordsOf(s.body);
    return { section: s, head, body, headPairs: pairsOf(head), bodyPairs: pairsOf(body) };
  });
  const df = new Map<string, number>();
  for (const p of parsed)
    for (const w of new Set([...p.head, ...p.body, ...p.headPairs, ...p.bodyPairs]))
      df.set(w, (df.get(w) ?? 0) + 1);
  const n = parsed.length;
  const rare = (w: string): number => Math.log(1 + n / (df.get(w) ?? n));

  const words = [...new Set(wordsOf(idea))];
  const pairs = [...new Set(pairsOf(wordsOf(idea)))];
  const scored = parsed
    .map((p) => {
      let score = 0;
      for (const w of words)
        score += rare(w) * ((p.head.includes(w) ? 3 : 0) + Math.min(countOf(p.body, w), 3));
      for (const w of pairs)
        score +=
          2 * rare(w) * ((p.headPairs.includes(w) ? 3 : 0) + Math.min(countOf(p.bodyPairs, w), 3));
      const repeated = p.head.filter((w) => words.includes(w)).length / Math.max(p.head.length, 1);
      return { section: p.section, score: score * (1 + repeated) };
    })
    .sort((a, b) => b.score - a.score);

  const [best, next] = scored;
  if (best === undefined || best.score < enough) return undefined;
  const lead = (best.score - (next?.score ?? 0)) / best.score;
  return lead >= clearLead ? best.section : undefined;
}

/**
 * The sections of a long version, split at its second-level headings, each with the address the page gives
 * its heading, matched by the heading's words so a stray line cannot shift them. A section with no
 * address, and the closing notes on what changed, are not linked to.
 */
export function sectionsOf(
  markdown: string,
  headings: readonly { text: string; slug: string }[],
): Section[] {
  const key = (t: string): string => wordsOf(t).join(' ');
  const unused = [...headings];
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const [line = '', ...rest] = part.split('\n');
      const heading = line.trim();
      const at = unused.findIndex((h) => key(h.text) === key(heading));
      const [found] = at >= 0 ? unused.splice(at, 1) : [];
      return { slug: found?.slug ?? '', heading, body: rest.join('\n') };
    })
    .filter((s) => s.slug.length > 0 && !/^what changed/i.test(s.heading));
}
