// Why: the run now goes on by itself, so nothing but the budget stops a chain of agents spending. Before an
// agent spends anything, this adds up what every run started this month has cost, across every thought's
// ledger, and checks that the agent's own allowance per run still fits under the monthly cap. An allowance
// is a card's estimate, not a limit a provider keeps, so every call is checked again before it is made: the
// most it could cost, on top of what the run has spent so far, must fit in what the month has left. At the
// cap the work waits (the project's atCap is "queue"); it is never done on credit.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { costOf, costs, type LedgerEvent, type UsageLog } from '@roadbook/core';
import { readRuns } from '@roadbook/core/node';
import { prices } from './prices.js';

/** A call stopped before it was made, because it might not fit under the monthly cap. */
export class BudgetError extends Error {
  override name = 'BudgetError';
}

/** What a run may still spend, given to every call it makes. */
export interface Purse {
  /** What the month had left under the cap when the run started. */
  leftUsd: number;
  /** A call whose price is known only once it is made (a drawing) is counted at this: the card's allowance. */
  unknownUsd: number;
}

/**
 * The most an ask can cost: its words counted at one token per two characters (text runs nearer four, and
 * the doubling also covers a cache write), each picture at 5,000 tokens, each web search at its price plus
 * 20,000 tokens of results, and every output token it is allowed to write.
 */
export function askCeiling(
  model: string,
  ask: { words: number; images: number; webSearches: number; maxOutputTokens: number },
): number {
  return costOf(prices, model, {
    inputTokens: Math.ceil(ask.words / 2) + ask.images * 5_000 + ask.webSearches * 20_000,
    outputTokens: ask.maxOutputTokens,
    ...(ask.webSearches > 0 ? { webSearches: ask.webSearches } : {}),
  });
}

/** Speech is priced by the character, so what a reading costs is known before it is made. */
export function speechCost(model: string, text: string): number {
  return costOf(prices, model, { characters: text.length });
}

/** What the calls logged so far have cost, priced as the ledger will price them. */
export function spentSoFar(log: UsageLog): number {
  return log.totals().reduce((sum, used) => sum + costOf(prices, used.model, used.usage), 0);
}

/** Stops a call that could cost `usd` when that, on top of what the run has spent, would pass the cap. */
export function afford(purse: Purse, log: UsageLog, what: string, usd: number): void {
  const left = purse.leftUsd - spentSoFar(log);
  if (usd > left)
    throw new BudgetError(
      `stopped at the monthly cap: ${what} could cost up to $${usd.toFixed(4)} and the month has $${Math.max(0, left).toFixed(4)} left`,
    );
}

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
