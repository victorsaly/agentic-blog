// Why: small pure helpers the pages share, kept free of Astro imports so they can be unit-tested.

/** The thought a collection entry belongs to: the first segment of its id ("<slug>/versions/long"). */
export function thoughtSlugOf(entryId: string): string {
  const [slug] = entryId.split('/');
  if (slug === undefined || slug.length === 0) {
    throw new Error(`entry id has no thought slug: ${entryId}`);
  }
  return slug;
}

/** The last segment of an id without a path: "<slug>/versions/long" → "long". */
export function leafOf(entryId: string): string {
  const leaf = entryId.split('/').at(-1);
  if (leaf === undefined || leaf.length === 0) {
    throw new Error(`entry id has no leaf: ${entryId}`);
  }
  return leaf;
}

/** Reading time in whole minutes at a gentle 180 words a minute, never less than one. */
export function readingMinutes(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  return Math.max(1, Math.round(words / 180));
}

const ordinals = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const;

/** "four minutes", "one minute", "twelve minutes" — words read better than digits beside a title. */
export function readingLabel(minutes: number): string {
  const word = ordinals[minutes - 1] ?? String(minutes);
  return minutes === 1 ? `${word} minute` : `${word} minutes`;
}

/** "23 October 2026", in British order, without a middle dot in sight. */
export function formatDate(date: Date, locale = 'en-GB', timeZone = 'Europe/London'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

/** Strips Markdown to plain text well enough for a description or a word count. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first N words of a text, ending cleanly with an ellipsis if cut. */
export function excerpt(text: string, words = 30): string {
  const parts = plainText(text).split(' ');
  return parts.length <= words ? parts.join(' ') : `${parts.slice(0, words).join(' ')}…`;
}
