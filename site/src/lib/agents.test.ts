// Why: the agent list on /how-it-works is the sales page's proof; a dropped agent or a wrong phase shows there.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstSentence, rosterFrom, type AgentCardFacts } from './agents.js';
import { tour } from './tour.js';

const cards = import.meta.glob<AgentCardFacts>('../../../agents/*/card.ts', {
  eager: true,
  import: 'card',
});

describe('rosterFrom', () => {
  it('lists name, why, phase, reads and writes, by phase then name', () => {
    const cards = rosterFrom([
      {
        name: 'safety',
        why: 'Reads for harm. Can hold.',
        phase: 5,
        reads: ['versions/*.md'],
        writes: ['safety.md'],
      },
      {
        name: 'interview',
        why: 'Asks.',
        phase: 1,
        reads: ['origin/*.md'],
        writes: ['interview.md'],
      },
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

  it('skips a card without a why or its workflow facts', () => {
    expect(rosterFrom([{ name: 'x', why: '', phase: 2, reads: [], writes: [] }])).toEqual([]);
  });

  it('finds all 13 agents from their cards', () => {
    expect(rosterFrom(Object.values(cards))).toHaveLength(13);
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
