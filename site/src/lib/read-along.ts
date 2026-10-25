// Why: the voice agent reads the short version aloud word for word and records when each word is said, so
// the page can mark the word being said while the reader listens. These pure functions match the spoken
// words to the words on the page (which the Markdown renderer may have given curly quotes, or split across
// a link), find the word being said at a moment in the audio, and notice a reader asking the chat to play
// it. When the page and the voice disagree on a single letter, the match fails and the page offers no
// voice at all, rather than one that says something the page does not.

/** One spoken word and when it starts and ends, in seconds from the start of the audio. */
export type TimedWord = readonly [word: string, start: number, end: number];

/** What the renderer may print for what the voice was given, folded back to plain keyboard characters. */
const FOLD: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '–': '--',
  '—': '---',
  '…': '...',
};

const fold = (c: string): string => FOLD[c] ?? c;
const foldAll = (text: string): string => text.replace(/[‘’“”–—…]/g, fold);
const isSpace = (c: string): boolean => /\s/.test(c);
const isLetter = (c: string): boolean => /[\p{L}\p{N}]/u.test(c);

/**
 * For each piece of page text (a text node, in reading order), the index of the spoken word each of its
 * characters belongs to, or null for a space or a mark only one side has. Null when the page and the voice
 * disagree on any letter or digit, on where a word ends ("a part" against "apart"), or the page ends before
 * the voice does.
 */
export function alignWords(
  pieces: readonly string[],
  words: readonly string[],
): (number | null)[][] | null {
  const said: { c: string; word: number }[] = [];
  words.forEach((word, i) => {
    const folded = foldAll(word);
    for (let k = 0; k < folded.length; k++) said.push({ c: folded.charAt(k), word: i });
  });
  const owners = pieces.map((piece) => new Array<number | null>(piece.length).fill(null));
  let at = 0;
  // The word of the last letter matched, and what the page printed since: nothing, only marks, or a space.
  let last: number | null = null;
  let gap: 'none' | 'mark' | 'space' = 'none';
  for (const [p, piece] of pieces.entries()) {
    const owner = owners[p];
    if (!owner) continue;
    let i = 0;
    while (i < piece.length) {
      const c = piece.charAt(i);
      if (isSpace(c)) {
        gap = 'space';
        i++;
        continue;
      }
      const f = fold(c);
      const next = said.slice(at, at + f.length);
      if (next.map((s) => s.c).join('') === f) {
        const word = next[0]?.word ?? null;
        if (isLetter(c) && word !== null) {
          // One word on one side is two on the other: a space inside a word, or none between two.
          if (last === word && gap === 'space') return null;
          if (last !== null && last !== word && gap === 'none') return null;
          last = word;
          gap = 'none';
        } else if (gap === 'none') gap = 'mark';
        owner[i] = word;
        at += f.length;
        i++;
      } else if (!isLetter(c)) {
        if (gap === 'none') gap = 'mark';
        i++; // a mark on the page the voice was not given
      } else if (at < said.length && !isLetter(said[at]?.c ?? '')) {
        at++; // a mark the voice was given that the page does not print
      } else {
        return null;
      }
    }
  }
  while (at < said.length && !isLetter(said[at]?.c ?? '')) at++;
  return at === said.length ? owners : null;
}

/** The word being said at a moment: the last one to have started, or -1 before the first. */
export function wordAt(words: readonly TimedWord[], seconds: number): number {
  let low = 0;
  let high = words.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((words[mid]?.[1] ?? Infinity) <= seconds) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found;
}

/**
 * Where a step from the keyboard lands: the start of the next word, or of the word being said (the one
 * before it when that word has only just begun). Seconds, never before 0 or past the last word's start.
 */
export function stepWord(words: readonly TimedWord[], seconds: number, direction: 1 | -1): number {
  // A little slack, so a seek that lands a hair before a word's start still counts as on that word.
  const now = wordAt(words, seconds + 0.05);
  const begun = seconds - (words[now]?.[1] ?? 0);
  const target = direction > 0 ? now + 1 : begun > 0.3 ? now : now - 1;
  if (target < 0) return 0;
  return words[Math.min(target, words.length - 1)]?.[1] ?? seconds;
}

/** A clock a reader reads: 1:36. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

const LISTEN =
  /^(?:(?:please|can you|could you|would you|will you)\s+)*(?:play|listen|read|tell me|say)(?:\s+(?:it|this|me|to me|to it|to this|the|post|idea|story|short|version|thought|aloud|out|loud|now|please|for me))*$/;

/** Whether a question to the chat is really a request to hear the post: "play it", "read it to me". */
export function isListenRequest(question: string): boolean {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return words !== '' && LISTEN.test(words) && !/^(?:tell me|say)$/.test(words);
}
