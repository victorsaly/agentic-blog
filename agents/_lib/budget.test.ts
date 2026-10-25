// Why: once the run goes on by itself, this is what stops it spending past the cap; a month counted wrong
// would either stop the blog for nothing or let a chain of agents run on credit.
import { describe, expect, it } from 'vitest';
import { Ledger } from '@roadbook/core';
import { fitsBudget, spentIn } from './budget.js';

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
});
