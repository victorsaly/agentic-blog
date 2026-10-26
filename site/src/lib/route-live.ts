// Why: a thought's route is drawn from the ledgers as of the last deploy, then brought up to date from the
// live copy, the same way the pipeline is (withLive): a step takes its live run's state when that run is
// newer than the ledger's latest, or is the same run and the ledger has no ending for it yet. For the same
// run an ending in the ledger wins, because it is the record and the live copy may have missed the run's last
// report; an older live run never overwrites a newer one. Each step opens the run that won, when the live
// copy holds it (a run's page reads the live copy). One place does it, so the pipeline and a run's page draw
// the same route.
import { routeOf, type Route, type RouteLayout, type StepState } from '@roadbook/core/route';
import type { LedgerEvent, NodeState } from '@roadbook/core';
import type { LiveCell } from './pipeline';

const nodeStates: readonly string[] = [
  'idle',
  'waiting',
  'running',
  'needs-you',
  'done',
  'held',
  'failed',
];
const isNodeState = (value: string): value is NodeState => nodeStates.includes(value);
const ended = (state: NodeState): boolean =>
  state === 'done' || state === 'held' || state === 'failed';

/** A step as the ledgers left it: its last recorded state, and the run that recorded it. */
export interface BuiltStep {
  state: NodeState;
  run: string;
}

/** Each step's last recorded state on a thought, gates included, with its run; runs oldest first. */
export function builtStepsOf(
  runs: readonly { id: string; events: readonly LedgerEvent[] }[],
): Record<string, BuiltStep> {
  const steps: Record<string, BuiltStep> = {};
  for (const run of runs)
    for (const event of run.events)
      if (event.type === 'node.state') steps[event.node] = { state: event.to, run: run.id };
  return steps;
}

export interface LiveRoute {
  route: Route;
  /** Where each step's latest run opens. */
  links: Record<string, string>;
}

const runLink = (id: string): string => `/studio/agents/run?id=${encodeURIComponent(id)}`;

/** A run GitHub has queued or started, as the page's GitHub feed knows it (agent-runs.ts LiveRun). */
export interface StartingRun {
  agent: string | null;
  thought: string | null;
  state: string;
}

export function liveRoute(
  layout: RouteLayout,
  built: Readonly<Record<string, BuiltStep>>,
  standing: readonly LiveCell[],
  thought: string,
  // GitHub's queued and started runs: a step GitHub is getting ready is at work, before the runner says so.
  starting: readonly StartingRun[] = [],
): LiveRoute {
  const known = new Map<string, NodeState>(
    Object.entries(built).map(([step, { state }]) => [step, state]),
  );
  const links: Record<string, string> = {};
  for (const cell of standing) {
    if (cell.thought !== thought) continue;
    const ledger = built[cell.agent];
    // Run ids begin with when the run started, so the later id is the later run.
    const ledgerWins =
      ledger !== undefined &&
      (cell.id < ledger.run || (cell.id === ledger.run && ended(ledger.state)));
    if (ledgerWins) {
      if (cell.id === ledger.run) links[cell.agent] = runLink(cell.id);
      continue;
    }
    if (isNodeState(cell.state)) known.set(cell.agent, cell.state);
    links[cell.agent] = runLink(cell.id);
  }
  for (const run of starting)
    if (
      run.thought === thought &&
      run.agent !== null &&
      (run.state === 'running' || run.state === 'queued') &&
      layout.steps.some((step) => step.id === run.agent)
    )
      known.set(run.agent, 'running');
  return { route: routeOf(layout, known), links };
}

/** Where a thought stands, read from its route, gates included: the one answer every part of the page gives. */
export interface RouteStanding {
  /** Waiting on Victor, did not finish, held, running, moving (some steps done), or not started. */
  state: 'waiting' | 'stopped' | 'held' | 'running' | 'moving' | 'untouched';
  /** The step it is at, first in working order; null when moving or not started. */
  at: string | null;
  /** Steps done, of every step drawn, so the count and the picture agree. */
  done: number;
  of: number;
}

/** What wins when steps differ: what needs Victor, then what stopped, then what works, then what is done. */
const ranked: readonly [StepState, RouteStanding['state']][] = [
  ['needs-you', 'waiting'],
  ['failed', 'stopped'],
  ['held', 'held'],
  ['running', 'running'],
];

export function standingOfRoute(route: Route): RouteStanding {
  const ordered = [...route.steps]
    .filter((s) => s.kind === 'agent' || s.kind === 'guard' || s.kind === 'gate')
    .sort((a, b) => a.column - b.column || a.row - b.row);
  const stateOf = (id: string): StepState => route.states[id] ?? 'not-run';
  const done = route.steps.filter((s) => stateOf(s.id) === 'done').length;
  const of = route.steps.length;
  for (const [step, state] of ranked) {
    const at = ordered.find((s) => stateOf(s.id) === step);
    if (at) return { state, at: at.id, done, of };
  }
  return { state: done > 0 ? 'moving' : 'untouched', at: null, done, of };
}

/**
 * The steps before a gate still at work: what a person would agree to before it is finished. The merge gate
 * stays shut while any is, so nothing goes live half-written.
 */
export function runningBefore(route: Route, gate: string): string[] {
  const before = new Set<string>();
  const walk = [gate];
  while (walk.length > 0) {
    const at = walk.pop() ?? '';
    for (const id of route.steps.find((s) => s.id === at)?.after ?? [])
      if (!before.has(id)) {
        before.add(id);
        walk.push(id);
      }
  }
  return route.steps
    .filter((s) => before.has(s.id) && route.states[s.id] === 'running')
    .map((s) => s.id);
}
