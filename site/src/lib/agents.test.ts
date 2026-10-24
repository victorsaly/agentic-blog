// Why: the agent list on /how-it-works is the sales page's proof; a dropped agent or a wrong phase shows there.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstSentence, rosterFrom } from './agents.js';
import { tour } from './tour.js';

const prompt = (meta: string): string => `---\n${meta}\n---\n\nBody.`;

describe('rosterFrom', () => {
  it('reads name, why, phase, reads and writes, by phase then name', () => {
    const cards = rosterFrom([
      prompt(
        'name: safety\nwhy: >\n  Reads for harm.\n  Can hold.\nphase: 5\nreads: [versions/*.md]\nwrites: [safety.md]',
      ),
      prompt('name: interview\nwhy: Asks.\nphase: 1\nreads: [origin/*.md]\nwrites: [interview.md]'),
    ]);
    expect(cards.map((c) => c.name)).toEqual(['interview', 'safety']);
    expect(cards[1]).toEqual({
      name: 'safety',
      why: 'Reads for harm. Can hold.',
      phase: 5,
      reads: ['versions/*.md'],
      writes: ['safety.md'],
      canHold: true,
    });
  });

  it('skips a prompt without a name, a why or a phase', () => {
    expect(rosterFrom([prompt('name: x\nphase: 2'), 'no front matter'])).toEqual([]);
  });

  it('finds every agent in the repo', () => {
    const root = new URL('../../../agents/', import.meta.url);
    const dirs = readdirSync(root, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && existsSync(new URL(`${d.name}/PROMPT.md`, root)),
    );
    const cards = rosterFrom(
      dirs.map((d) => readFileSync(new URL(`${d.name}/PROMPT.md`, root), 'utf8')),
    );
    expect(cards).toHaveLength(dirs.length);
  });
});

describe('firstSentence', () => {
  it('stops at the first full stop followed by a space', () => {
    expect(firstSentence('Every claim gets a door out. This agent finds…')).toBe(
      'Every claim gets a door out.',
    );
  });
});

describe('tour', () => {
  it('has a voice clip for every station', () => {
    for (const station of tour) {
      expect(
        existsSync(new URL(`../../public/tour/${station.id}.mp3`, import.meta.url)),
        station.id,
      ).toBe(true);
    }
  });

  it('has a print for every station', () => {
    for (const station of tour) {
      expect(
        existsSync(new URL(`../../public/tour/${station.id}.png`, import.meta.url)),
        station.id,
      ).toBe(true);
    }
  });
});
