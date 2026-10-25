// Why: once the run goes on by itself, this is what stops it spending past the cap; a month counted wrong
// would either stop the blog for nothing or let a chain of agents run on credit.
import { describe, expect, it } from 'vitest';
import { Ledger } from '@roadbook/core';
import { askCeiling, fitsBudget, speechCost, spentIn } from './budget.js';

async function runOn(day: string, usd: number) {
  const ledger = new Ledger({ now: () => new Date(`${day}T10:00:00Z`) });
  await ledger.append({ type: 'run.started', workflow: 'w', origin: 'o', by: 'local' });
  await ledger.append({ type: 'cost.incurred', node: 'seo', provider: 'claude', usd, units: 'u' });
  return { events: ledger.events };
}

describe('the monthly budget', () => {
  it('adds up only the runs that started in the month', async () => {
    const runs = [
      await runOn('2026-09-30', 5),
      await runOn('2026-10-01', 1.25),
      await runOn('2026-10-25', 0.5),
    ];
    expect(spentIn(runs, '2026-10')).toBeCloseTo(1.75);
  });

  it('lets a run start only when its allowance still fits under the cap', () => {
    expect(fitsBudget(29, 0.5, 30)).toBe(true);
    expect(fitsBudget(29.6, 0.5, 30)).toBe(false);
    expect(fitsBudget(29.5, 0.5, 30)).toBe(true);
  });

  it('knows what a reading costs before it is made, and never counts an ask as cheaper than it could be', () => {
    // The longest reading the voice card allows: 400 words, about 2,800 characters.
    expect(speechCost('eleven_v3', 'x'.repeat(2800))).toBeCloseTo(0.224);
    // 4,000 characters, two web searches, 1,000 output tokens of Sonnet: 42,000 input tokens at $2 a
    // million, 1,000 output tokens at $10 a million, and $0.02 for the searches.
    expect(
      askCeiling('claude-sonnet-5-5', {
        words: 4000,
        images: 0,
        webSearches: 2,
        maxOutputTokens: 1000,
      }),
    ).toBeCloseTo(0.084 + 0.01 + 0.02);
  });
});
