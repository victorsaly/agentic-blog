// Why: the run now goes on by itself, so nothing but the budget stops a chain of agents spending. Before an
// agent spends anything, this adds up what every run started this month has cost, across every thought's
// ledger, and checks that the agent's own allowance per run still fits under the monthly cap. At the cap
// the work waits (the project's atCap is "queue"); it is never started on credit.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { costs, type LedgerEvent } from '@roadbook/core';
import { readRuns } from '@roadbook/core/node';

/** What the runs that started in `month` (YYYY-MM) cost, as their ledgers recorded it. */
export function spentIn(
  runs: readonly { events: readonly LedgerEvent[] }[],
  month: string,
): number {
  return runs
    .filter((run) => run.events[0]?.at.startsWith(month) === true)
    .reduce((sum, run) => sum + costs(run.events).totalUsd, 0);
}

/** True when one more run, at most `usdPerRun`, still fits under the cap. */
export function fitsBudget(spentUsd: number, usdPerRun: number, capUsd: number): boolean {
  return spentUsd + usdPerRun <= capUsd;
}

/** Every thought's runs in this checkout, read and verified; a run that does not verify is an error. */
export async function monthSpend(root: string, month: string): Promise<number> {
  const thoughts = join(root, 'thoughts');
  let total = 0;
  const folders = (await readdir(thoughts, { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const { name: slug } of folders) {
    const { runs, issues } = await readRuns(join(thoughts, slug), `thoughts/${slug}`);
    if (issues.length > 0) throw new Error(issues.join(' '));
    total += spentIn(runs, month);
  }
  return Math.round(total * 1_000_000) / 1_000_000;
}
