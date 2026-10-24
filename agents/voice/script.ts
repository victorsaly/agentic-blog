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
        .map((line) =>
          line
            .replace(/^\s{0,3}#{1,6}\s+/, '')
            .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
            .replace(/^\s*>\s?/, '')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/(\*\*|__)(.+?)\1/g, '$2')
            .replace(/(\*|_)(.+?)\1/g, '$2')
            .replace(/`([^`]+)`/g, '$1')
            .trim(),
        )
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
