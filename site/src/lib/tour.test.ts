// Why: the tour says every word on screen and underlines the word being said, so a line changed without its
// clip being made again would underline the wrong words, and a station without its screen would show none.
// This fails the build first.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tour, tourWordsFrom } from './tour.js';
import words from './tour-words.json';

const timings = tourWordsFrom(words);
const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

describe('the tour', () => {
  for (const s of tour) {
    it(`${s.id}: the clip says the line on screen, word for word, in order`, () => {
      const spoken = timings[s.id];
      expect(spoken, 'run npm run tour:voice for this station').toBeDefined();
      expect(spoken?.map((w) => w[0])).toEqual(s.line.split(/\s+/).filter((w) => w !== ''));
      spoken?.forEach(([, start, end], i) => {
        expect(end).toBeGreaterThanOrEqual(start);
        if (i > 0) expect(start).toBeGreaterThanOrEqual(spoken[i - 1]?.[1] ?? 0);
      });
    });

    it(`${s.id}: has its clip, its print and its real screen`, () => {
      expect(existsSync(here(`../../public/tour/${s.id}.mp3`))).toBe(true);
      expect(existsSync(here(`../../public/tour/${s.id}.png`))).toBe(true);
      expect(existsSync(here(`../assets/tour/${s.id}.png`))).toBe(true);
    });
  }
});
