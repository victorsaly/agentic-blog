// Why: the voice agent must read exactly what the page shows, and the page must be able to light each word
// as it is spoken. These pure functions decide what is spoken, fingerprint it so a changed text is noticed,
// and turn the voice service's per-character clock into a per-word one. No network, no disk.
import { createHash } from 'node:crypto';
import matter from 'gray-matter';

/** One spoken word and when it starts and ends, in seconds from the start of the audio. */
export type TimedWord = readonly [word: string, start: number, end: number];

/** What the voice service returns for the text it was given: one entry per character. */
export interface CharacterClock {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

const OPEN = '\uE000';
const CLOSE = '\uE001';

/** Code spans are lifted out before the emphasis marks go, so `get_user_id` is spoken as written. */
function plainLine(line: string): string {
  const code: string[] = [];
  const stripped = line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(
      /`([^`]+)`/g,
      (_match, inner: string) => `${OPEN}${String(code.push(inner) - 1)}${CLOSE}`,
    )
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1')
    .replace(/(^|[^\w])__(\S(?:.*?\S)?)__(?=[^\w]|$)/g, '$1$2')
    .replace(/\*(\S(?:.*?\S)?)\*/g, '$1')
    .replace(/(^|[^\w])_(\S(?:.*?\S)?)_(?=[^\w]|$)/g, '$1$2');
  return stripped
    .replace(
      new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'),
      (_match, index: string) => code[Number(index)] ?? '',
    )
    .trim();
}

/**
 * The words a listener hears, from a version's Markdown: no front matter, no lines that carry the site's
 * badge or link, no markup. Paragraphs stay separate so the voice pauses between them.
 */
export function spokenText(markdown: string, domain: string): string {
  const body = matter(markdown).content;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => domain === '' || !line.includes(domain))
        .map(plainLine)
        .filter((line) => line !== '')
        .join(' '),
    )
    .filter((paragraph) => paragraph !== '');
  return paragraphs.join('\n\n');
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w !== '').length;
}

/** A fingerprint of the spoken text; the agent skips a run when the text has not changed since. */
export function fingerprint(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const round = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/** The clock of the same speech played at `speed` times the pace: every time divided by the speed. */
export function quickenClock(clock: CharacterClock, speed: number): CharacterClock {
  return {
    characters: clock.characters,
    characterStartTimesSeconds: clock.characterStartTimesSeconds.map((t) => t / speed),
    characterEndTimesSeconds: clock.characterEndTimesSeconds.map((t) => t / speed),
  };
}

/**
 * Words with their start and end, from the character clock. A word runs from the start of its first
 * character to the end of its last; whitespace separates words and belongs to none.
 */
export function wordsFromClock(clock: CharacterClock): TimedWord[] {
  const words: TimedWord[] = [];
  let word = '';
  let start = 0;
  let end = 0;
  const flush = (): void => {
    if (word !== '') words.push([word, round(start), round(end)]);
    word = '';
  };
  clock.characters.forEach((character, index) => {
    if (/\s/.test(character)) {
      flush();
      return;
    }
    const from = clock.characterStartTimesSeconds[index];
    const to = clock.characterEndTimesSeconds[index];
    if (from === undefined || to === undefined) throw new Error('the voice clock is incomplete');
    if (word === '') start = from;
    word += character;
    end = to;
  });
  flush();
  return words;
}

/**
 * True when the clock's words are the spoken text's words, in order. The page lights words by position,
 * so a clock that dropped or added one would put every later word out of step.
 */
export function clockMatches(text: string, words: readonly TimedWord[]): boolean {
  const spoken = text.split(/\s+/).filter((w) => w !== '');
  return spoken.length === words.length && spoken.every((w, i) => w === words[i]?.[0]);
}

/** Seconds of audio, from the last word's end. */
export function durationOf(words: readonly TimedWord[]): number {
  return words.at(-1)?.[2] ?? 0;
}
