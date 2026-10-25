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

/** A run that produced something but recorded no cost: what it spent is unknown, not zero. */
const madeWithoutCost = (events: readonly LedgerEvent[]): boolean =>
  events.some((e) => e.type === 'node.output') && !events.some((e) => e.type === 'cost.incurred');

/** What a post may say about how it was made; null when nothing is recorded, so no empty box is drawn. */
export function howMade(
  runs: readonly { id: string; events: readonly LedgerEvent[] }[],
): HowMade | null {
  const all = runs.flatMap((r) => r.events);
  if (all.length === 0) return null;

  const latest = new Map<string, MadeStep>();
  const count = new Map<string, number>();
  for (const run of runs) {
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
      costed: !madeWithoutCost(run.events),
      runs: 0,
    });
  }
  const steps = [...latest.values()].map((s) => ({ ...s, runs: count.get(s.agent) ?? 1 }));

  // A run that produced something without a recorded cost leaves the total as a floor; one that stopped
  // before calling anything (held by a check, nothing to do) really cost nothing.
  const uncosted = runs.some((r) => madeWithoutCost(r.events));
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

export interface Currency {
  show: 'GBP' | 'USD';
  /** Units of the shown currency to one US dollar. */
  perUsd: number;
}

/**
 * A cost recorded in US dollars, as a reader reads it in the site's currency: pence or cents below one unit
 * ("3.7p", "4.9¢"), pounds or dollars above ("£1.20").
 */
export function moneyOf(usd: number, currency: Currency = { show: 'USD', perUsd: 1 }): string {
  const amount = usd * currency.perUsd;
  const [major, minor] = currency.show === 'GBP' ? ['£', 'p'] : ['$', '¢'];
  if (amount < 1) {
    const small = amount * 100;
    return `${small < 0.1 && small > 0 ? '<0.1' : small.toFixed(small < 10 ? 1 : 0)}${minor}`;
  }
  return `${major}${amount.toFixed(2)}`;
}
