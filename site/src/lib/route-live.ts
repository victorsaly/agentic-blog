// Why: a thought's route is drawn from the ledgers as of the last deploy, then brought up to date from the
// live copy, the same way the pipeline is (withLive): a step takes its live run's state when that run is
// newer than the ledger's latest, or is the same run and the ledger has no ending for it yet. For the same
// run an ending in the ledger wins, because it is the record and the live copy may have missed the run's last
// report; an older live run never overwrites a newer one. Each step opens the run that won, when the live
// copy holds it (a run's page reads the live copy). One place does it, so the pipeline and a run's page draw
// the same route.
import { routeOf, type Route, type RouteLayout } from '@roadbook/core/route';
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

export function liveRoute(
  layout: RouteLayout,
  built: Readonly<Record<string, BuiltStep>>,
  standing: readonly LiveCell[],
  thought: string,
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
  return { route: routeOf(layout, known), links };
}
