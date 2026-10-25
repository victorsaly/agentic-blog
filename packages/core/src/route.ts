// Why: a person answers for a workflow they can see. The ledger says where every step stands, but a list of
// states does not show the route: what comes after what, where two steps join, where a person decides. This
// lays a workflow out as a route to draw, left to right in working order (each step one column past the
// latest step it waits for), and fills in where each step stands. The layout comes from the workflow alone
// and can be made once; the states come from a ledger, or from a live copy, as a plain map. Pure, and it
// knows nothing about any one project, so every Roadbook project gets the same picture of its runs.
import type { LedgerEvent, NodeState } from './ledger.js';
import type { NodeInput, WorkflowInput } from './schema.js';

export type StepKind = NodeInput['kind'];

/** Where a step stands on the route. Steps the ledger does not record (inputs, tools) take their state from
 * what they lead to: done once anything after them has started. */
export type StepState = 'not-run' | 'running' | 'needs-you' | 'done' | 'held' | 'failed';

export interface RouteStep {
  id: string;
  kind: StepKind;
  /** Working order: one past the latest step this one waits for. */
  column: number;
  /** Its place in the column, in the order the workflow declares its steps. */
  row: number;
  /** The steps it waits for. */
  after: string[];
}

export interface RouteLayout {
  steps: RouteStep[];
  edges: { from: string; to: string }[];
  columns: number;
  rows: number;
}

export interface Route extends RouteLayout {
  states: Record<string, StepState>;
}

/** The route of a workflow, ready to draw: every step's column and row, and the lines between them. */
export function layoutOf(workflow: WorkflowInput): RouteLayout {
  const nodes = Object.entries(workflow.nodes);
  const column = new Map<string, number>();
  const placing = new Set<string>();
  const place = (id: string): number => {
    const known = column.get(id);
    if (known !== undefined) return known;
    // A workflow is checked to have no loops before it runs; this only keeps a bad one from hanging.
    if (placing.has(id)) return 0;
    placing.add(id);
    const after = (workflow.nodes[id]?.after ?? []).filter((a) => a in workflow.nodes);
    const at = after.length === 0 ? 0 : Math.max(...after.map(place)) + 1;
    column.set(id, at);
    return at;
  };
  for (const [id] of nodes) place(id);
  const filled = new Map<number, number>();
  const steps = nodes.map(([id, node]): RouteStep => {
    const at = column.get(id) ?? 0;
    const row = filled.get(at) ?? 0;
    filled.set(at, row + 1);
    return {
      id,
      kind: node.kind,
      column: at,
      row,
      after: (node.after ?? []).filter((a) => a in workflow.nodes),
    };
  });
  return {
    steps,
    edges: steps.flatMap((s) => s.after.map((from) => ({ from, to: s.id }))),
    columns: Math.max(0, ...steps.map((s) => s.column)) + 1,
    rows: Math.max(0, ...filled.values()),
  };
}

const recorded = (kind: StepKind): boolean =>
  kind !== 'input' && kind !== 'tool' && kind !== 'branch';

/** Each step's last recorded state, from every run's events in the order they happened. */
export function statesOfRuns(
  runs: readonly { events: readonly LedgerEvent[] }[],
): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  for (const run of runs)
    for (const event of run.events)
      if (event.type === 'node.state') states.set(event.node, event.to);
  return states;
}

const shown = (state: NodeState | undefined): StepState => {
  if (state === undefined || state === 'idle') return 'not-run';
  if (state === 'waiting') return 'running';
  return state;
};

/**
 * The route with where each step stands. `known` is each recorded step's last state (from statesOfRuns, or
 * a live copy). A step that is not recorded is done once any step further along the route has started; a
 * sink is done when every step before it is.
 */
export function routeOf(layout: RouteLayout, known: ReadonlyMap<string, NodeState>): Route {
  const states: Record<string, StepState> = {};
  for (const step of layout.steps)
    if (recorded(step.kind) && step.kind !== 'sink') states[step.id] = shown(known.get(step.id));
  const started = (id: string): boolean => {
    const state = states[id];
    return state !== undefined && state !== 'not-run';
  };
  // Anything further along the route that has started means an unrecorded step before it was passed.
  const passed = (id: string): boolean => {
    const seen = new Set<string>();
    const walk = [id];
    while (walk.length > 0) {
      const at = walk.pop() ?? '';
      for (const edge of layout.edges.filter((e) => e.from === at && !seen.has(e.to))) {
        seen.add(edge.to);
        if (started(edge.to)) return true;
        walk.push(edge.to);
      }
    }
    return false;
  };
  for (const step of layout.steps.filter((s) => !recorded(s.kind) || s.kind === 'sink')) {
    states[step.id] =
      step.kind === 'sink'
        ? step.after.length > 0 && step.after.every((a) => states[a] === 'done')
          ? 'done'
          : 'not-run'
        : passed(step.id)
          ? 'done'
          : 'not-run';
  }
  return { ...layout, states };
}
