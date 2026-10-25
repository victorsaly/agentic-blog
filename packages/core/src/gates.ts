// Why: a workflow's gates are where a person decides, and until now nothing recorded that one had opened:
// the owner had to know. When a step finishes, this says which gates after it are now waiting, from the
// workflow and the ledger alone, so the runner can open each as a run that waits and the owner sees the
// question where they already look. A gate opens only when everything before it is done, and never twice
// while it is still waiting. It takes the workflow as written in the project file. Pure, so the rule is
// tested here.
import type { LedgerEvent, NodeState } from './ledger.js';
import type { WorkflowInput } from './schema.js';

export interface GateToOpen {
  id: string;
  asks: 'answer' | 'approve' | 'pick';
  question: string;
}

/** Where each node stands, from every run's events in the order they happened: its last recorded state. */
function statesOf(runs: readonly { events: readonly LedgerEvent[] }[]): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  for (const run of runs)
    for (const event of run.events)
      if (event.type === 'node.state') states.set(event.node, event.to);
  return states;
}

/**
 * The gates that open now that `finished` is done. `runs` are every run on the item, oldest first, the one
 * that just finished included. A step the ledger does not record (an input, a tool, a branch) never holds a gate back;
 * a step it does record must have last ended done. A gate still waiting is not opened again.
 */
export function gatesToOpen(
  workflow: WorkflowInput,
  finished: string,
  runs: readonly { events: readonly LedgerEvent[] }[],
): GateToOpen[] {
  const states = statesOf(runs);
  if (states.get(finished) !== 'done') return [];
  const recorded = (id: string): boolean => {
    const node = workflow.nodes[id];
    return node !== undefined && !['input', 'tool', 'branch'].includes(node.kind);
  };
  return Object.entries(workflow.nodes).flatMap(([id, node]) => {
    const after = node.after ?? [];
    if (node.kind !== 'gate' || !after.includes(finished)) return [];
    if (states.get(id) === 'needs-you') return [];
    const ready = after.every((before) => !recorded(before) || states.get(before) === 'done');
    return ready ? [{ id, asks: node.asks, question: node.question }] : [];
  });
}
