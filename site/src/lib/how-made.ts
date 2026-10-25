// Why: "How this was made" on a post is read from the ledger and nothing else, so it can never claim more
// care, or less AI, than happened. This turns a thought's verified runs into what a reader is told: each
// agent's latest run and how it ended, what the runs cost, what a person edited or wrote, and every override
// with its reason. A guard's hold reason is not passed on: it can quote what the guard found (another
// person, a secret), which is exactly what must not be published; the reader learns only that it held.
import { costs, disclosure, type LedgerEvent } from '@roadbook/core';

export type Ending = 'done' | 'held' | 'failed' | 'running' | 'not-run';

export interface MadeStep {
  agent: string;
  /** When its latest run started, as an ISO date. */
  on: string;
  ended: Ending;
  /** What its latest run cost, as recorded. */
  usd: number;
  /** False when the run recorded no cost at all, so its dollars are not known, not zero. */
  costed: boolean;
  /** How many times it has run on this thought. */
  runs: number;
}

export interface HowMade {
  steps: MadeStep[];
  /** Every run's recorded cost, added up. */
  totalUsd: number;
  /** True when some run recorded no cost, so the total is a floor. */
  totalIsFloor: boolean;
  /** When the first recorded run started, as an ISO date. */
  since: string;
  editedByPerson: string[];
  byPerson: string[];
  overrides: { node: string; reason: string; by: string }[];
}

const endingOf = (state: string): Ending =>
  state === 'done' || state === 'held' || state === 'failed'
    ? state
    : state === 'running'
      ? 'running'
      : 'not-run';

/**
 * A run whose cost is unknown, not zero: it produced something, or it failed (a provider can bill a call
 * that then errors before its usage is read), and no cost was recorded. A run that stopped before calling
 * anything (held by a check, nothing to do) really cost nothing.
 */
const costUnknown = (events: readonly LedgerEvent[]): boolean =>
  !events.some((e) => e.type === 'cost.incurred') &&
  (events.some((e) => e.type === 'node.output') ||
    events.some((e) => e.type === 'node.state' && e.to === 'failed'));

/**
 * A gate's run: it waits on a person's decision, and records no agent's work. Neither "How this was made"
 * nor the list of runs and costs counts it as a step.
 */
export const isGateRun = (events: readonly LedgerEvent[]): boolean =>
  events.some((e) => e.type === 'gate.opened');

/** What a post may say about how it was made; null when nothing is recorded, so no empty box is drawn. */
export function howMade(
  runs: readonly { id: string; events: readonly LedgerEvent[] }[],
): HowMade | null {
  const all = runs.flatMap((r) => r.events);
  if (all.length === 0) return null;

  const latest = new Map<string, MadeStep>();
  const count = new Map<string, number>();
  for (const run of runs) {
    if (isGateRun(run.events)) continue;
    const states = run.events.filter((e) => e.type === 'node.state');
    const agent = states[0]?.node;
    if (agent === undefined) continue;
    count.set(agent, (count.get(agent) ?? 0) + 1);
    const last = states.at(-1);
    const spent = costs(run.events);
    latest.set(agent, {
      agent,
      on: (run.events[0]?.at ?? '').slice(0, 10),
      ended: endingOf(last?.to ?? 'idle'),
      usd: spent.totalUsd,
      costed: !costUnknown(run.events),
      runs: 0,
    });
  }
  const steps = [...latest.values()].map((s) => ({ ...s, runs: count.get(s.agent) ?? 1 }));

  // A run whose cost is unknown leaves the total as a floor.
  const uncosted = runs.some((r) => costUnknown(r.events));
  const told = disclosure(all);
  return {
    steps,
    totalUsd: Math.round(costs(all).totalUsd * 1_000_000) / 1_000_000,
    totalIsFloor: uncosted,
    since: (all[0]?.at ?? '').slice(0, 10),
    editedByPerson: told.editedByPerson,
    byPerson: told.byPerson,
    overrides: told.overrides,
  };
}

export { moneyOf, type Currency } from './money';

// ---------------------------------------------------------------------------------------------- the studio

/** One run as Victor sees it in the studio: what ran, when, how it ended, what it cost. */
export interface RunRow {
  id: string;
  agent: string;
  /** When it started, as an ISO date. */
  on: string;
  ended: Ending;
  usd: number;
  costed: boolean;
}

/** Every agent run of a thought, newest first; a gate's run is a decision, not a run to cost. */
export function runRows(runs: readonly { id: string; events: readonly LedgerEvent[] }[]): RunRow[] {
  return runs
    .filter((run) => !isGateRun(run.events))
    .map((run) => {
      const states = run.events.filter((e) => e.type === 'node.state');
      return {
        id: run.id,
        agent: states[0]?.node ?? 'unknown',
        on: (run.events[0]?.at ?? '').slice(0, 10),
        ended: endingOf(states.at(-1)?.to ?? 'idle'),
        usd: costs(run.events).totalUsd,
        costed: !costUnknown(run.events),
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

/** How much of the monthly cap is spent, in words. A few pence is not nothing: below 1% says so. */
export function shareOfCap(usd: number, capUsd: number): string {
  const percent = capUsd > 0 ? (usd / capUsd) * 100 : 0;
  return percent > 0 && percent < 1 ? 'under 1%' : `${String(Math.round(percent))}%`;
}

/** What the runs that started in a month (YYYY-MM) cost, and whether any of them left its cost unknown. */
export function spendIn(rows: readonly RunRow[], month: string): { usd: number; isFloor: boolean } {
  const inMonth = rows.filter((r) => r.on.startsWith(month));
  return {
    usd: Math.round(inMonth.reduce((sum, r) => sum + r.usd, 0) * 1_000_000) / 1_000_000,
    isFloor: inMonth.some((r) => !r.costed),
  };
}
