// Why: the agent list on /how-it-works is the sales page's proof; a dropped agent or a wrong phase shows there.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstSentence, rosterFrom, type AgentCardFacts } from './agents.js';
import { tour } from './tour.js';

const cards = import.meta.glob<AgentCardFacts>('../../../agents/*/card.ts', {
  eager: true,
  import: 'card',
});
const prompts = import.meta.glob<string>('../../../agents/*/PROMPT.md', {
  query: '?raw',
  eager: true,
  import: 'default',
});
const prompt = (meta: string): string => `---\n${meta}\n---\n\nBody.`;

describe('rosterFrom', () => {
  it('lists name, why, phase, reads and writes, by phase then name', () => {
    const roster = rosterFrom(
      [
        {
          name: 'safety',
          phase: 5,
          reads: ['versions/*.md'],
          writes: ['safety.md'],
        },
        {
          name: 'interview',
          phase: 1,
          reads: ['origin/*.md'],
          writes: ['interview.md'],
        },
      ],
      [
        prompt('name: safety\nwhy: >\n  Reads for harm.\n  Can hold.'),
        prompt('name: interview\nwhy: Asks.'),
      ],
    );
    expect(roster.map((c) => c.name)).toEqual(['interview', 'safety']);
    expect(roster[1]).toEqual({
      name: 'safety',
      why: 'Reads for harm. Can hold.',
      phase: 5,
      reads: ['versions/*.md'],
      writes: ['safety.md'],
      canHold: true,
    });
  });

  it('stops with the agent name when its prompt has no why, rather than dropping it', () => {
    expect(() => rosterFrom([{ name: 'x', phase: 2, reads: [], writes: [] }], [])).toThrow(
      'agents/x: PROMPT.md has no why',
    );
  });

  it('still lists an agent that reads or writes nothing', () => {
    expect(
      rosterFrom(
        [{ name: 'x', phase: 2, reads: [], writes: [] }],
        [prompt('name: x\nwhy: Waits.')],
      ),
    ).toEqual([{ name: 'x', why: 'Waits.', phase: 2, reads: [], writes: [], canHold: false }]);
  });

  it('finds all 14 agents from their cards', () => {
    expect(rosterFrom(Object.values(cards), Object.values(prompts))).toHaveLength(14);
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
