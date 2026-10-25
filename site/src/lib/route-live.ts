// Why: a thought's route is drawn from the ledgers as of the last deploy, then brought up to date from the
// live copy, the same way the pipeline is: each step takes its latest live run's state when the live copy
// knows one, and opens that run. One place does it, so the pipeline and a run's page draw the same route.
import { routeOf, type Route, type RouteLayout } from '@roadbook/core/route';
import type { NodeState } from '@roadbook/core';
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

export interface LiveRoute {
  route: Route;
  /** Where each step's latest live run opens. */
  links: Record<string, string>;
}

export function liveRoute(
  layout: RouteLayout,
  built: Readonly<Record<string, NodeState>>,
  standing: readonly LiveCell[],
  thought: string,
): LiveRoute {
  const known = new Map<string, NodeState>(Object.entries(built));
  const links: Record<string, string> = {};
  for (const cell of standing) {
    if (cell.thought !== thought) continue;
    if (isNodeState(cell.state)) known.set(cell.agent, cell.state);
    links[cell.agent] = `/studio/agents/run?id=${encodeURIComponent(cell.id)}`;
  }
  return { route: routeOf(layout, known), links };
}
