// Why: the card check must accept matching facts and name the prompt field to fix when facts drift.
import { describe, expect, it } from 'vitest';
import { compareCardFacts } from './check-cards.js';

const prompt = (facts: string): string => `---\n${facts}\n---\n\nInstructions.`;
const card = { name: 'interview', phase: 1, reads: ['origin/*.md'], writes: ['interview.md'] };

describe('compareCardFacts', () => {
  it('accepts matching facts', () => {
    expect(
      compareCardFacts(
        prompt('name: interview\nphase: 1\nreads: [origin/*.md]\nwrites: [interview.md]'),
        card,
        'agents/interview',
      ),
    ).toEqual([]);
  });

  it('reports each mismatch and makes the card the source of truth', () => {
    expect(
      compareCardFacts(
        prompt('name: interview\nphase: 2\nreads: [profile.md]\nwrites: [questions.md]'),
        card,
        'agents/interview',
      ),
    ).toEqual([
      'agents/interview: phase differs (PROMPT.md: 2; card.ts: 1). Fix: make PROMPT.md match card.ts.',
      'agents/interview: reads differs (PROMPT.md: ["profile.md"]; card.ts: ["origin/*.md"]). Fix: make PROMPT.md match card.ts.',
      'agents/interview: writes differs (PROMPT.md: ["questions.md"]; card.ts: ["interview.md"]). Fix: make PROMPT.md match card.ts.',
    ]);
  });

  it('rejects missing front matter and incomplete cards', () => {
    expect(compareCardFacts('Instructions only.', card, 'agents/interview')).toEqual([
      'agents/interview: PROMPT.md has no front matter. Fix: add front matter matching card.ts.',
    ]);
    expect(compareCardFacts(prompt('name: interview'), card, 'agents/interview')).toEqual([
      'agents/interview: PROMPT.md must define name, phase, reads and writes. Fix: copy those facts from card.ts.',
    ]);
  });
});
