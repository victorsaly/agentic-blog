// Why: a post's sources sit beside the claims they support. The citations agent writes sources.md as a
// table (what the post says, the door out, what is there); these pure functions read that table into
// numbered claims and decide which paragraph each claim belongs to, so the page can put a small number in
// the text and a ruled list at the end. Tested without a build.

export interface Door {
  label: string;
  url: string;
  /** What kind of source it is, as the agent noted it, e.g. "(Wikipedia)". */
  note?: string;
}

export interface Claim {
  /** The first column as written: what the post says. */
  mention: string;
  /** The words to look for in the post: the quoted part of the mention, or the mention itself. */
  quote: string;
  doors: Door[];
  /** What is behind the door, when the table says. */
  about?: string;
}

export interface SourceList {
  claims: Claim[];
  /** Lines the agent found no source for, in plain words. */
  unsourced: string[];
}

const plain = (text: string): string =>
  text
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function doorsIn(cell: string): Door[] {
  const doors: Door[] = [];
  for (const m of cell.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)\s*(\([^)]*\))?/g)) {
    const [, label = '', url = '', note] = m;
    doors.push({ label: plain(label), url, ...(note ? { note } : {}) });
  }
  if (doors.length > 0) return doors;
  for (const m of cell.matchAll(/https?:\/\/[^\s)|]+/g)) {
    const url = m[0];
    const { hostname, pathname } = new URL(url);
    doors.push({ label: `${hostname.replace(/^www\./, '')}${pathname.replace(/\/$/, '')}`, url });
  }
  return doors;
}

/** Reads sources.md: its table of claims and doors, and its list of lines with no door. */
export function parseSources(markdown: string): SourceList {
  const lines = markdown.split('\n');
  const claims: Claim[] = [];
  let columns: { mention: number; door: number; about: number } | null = null;

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      columns = null;
      continue;
    }
    const row = cells(line);
    if (row.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    if (!columns) {
      const at = (word: RegExp): number => row.findIndex((c) => word.test(c.toLowerCase()));
      columns = { mention: at(/mention/), door: at(/door/), about: at(/what is there/) };
      continue;
    }
    if (columns.mention < 0 || columns.door < 0) continue;
    const mention = plain(row[columns.mention] ?? '');
    const doors = doorsIn(row[columns.door] ?? '');
    const about = columns.about >= 0 ? plain(row[columns.about] ?? '') : '';
    const previous = claims.at(-1);
    if (/^same claim/i.test(mention) && previous) {
      previous.doors.push(...doors);
      continue;
    }
    if (doors.length === 0) continue;
    const quoted = /[“"]([^”"]+)[”"]/.exec(mention)?.[1];
    claims.push({
      mention,
      quote: plain(quoted ?? mention.replace(/\([^)]*\)/g, '')),
      doors,
      ...(about ? { about } : {}),
    });
  }

  const unsourced: string[] = [];
  let inNoDoor = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) inNoDoor = /no door/i.test(line);
    else if (inNoDoor && /^\s*-\s+/.test(line)) unsourced.push(plain(line.replace(/^\s*-\s+/, '')));
  }
  return { claims, unsourced };
}

const words = (text: string): string[] =>
  text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 3);

/**
 * Whether a paragraph carries a claim: most of the claim's longer words appear in it. The post's
 * versions reword the note, so an exact match would miss; most-of-the-words survives light rewording.
 */
export function carries(paragraph: string, quote: string): boolean {
  const wanted = [...new Set(words(quote))];
  if (wanted.length === 0) return false;
  const have = new Set(words(paragraph));
  const found = wanted.filter((w) => have.has(w)).length;
  return found / wanted.length >= 0.7;
}
