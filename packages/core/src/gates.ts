// Why: a workflow's gates are where a person decides, and until now nothing recorded that one had opened:
// the owner had to know. When a step finishes, this says which gates after it are now waiting, from the
// workflow and the ledger alone, so the runner can open each as a run that waits and the owner sees the
// question where they already look. A gate opens only when everything before it is done, and never twice
// while it is still waiting. Closing one is checked here too: only an open gate, only by a person, and only
// with a decision that answers what it asked. And once a step is done, which steps start next: the run goes
// on by itself, from the workflow and the ledger alone, up to the next gate. It takes the workflow as written in the project file. Pure, so the rule is
// tested here.
import { isPerson, type EventBody, type LedgerEvent, type NodeState } from './ledger.js';
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

export type GateDecision = 'answered' | 'approved' | 'redirected' | 'picked';

/** What each kind of gate can be closed with. Words are required where the decision is nothing without them. */
const fits: Record<GateToOpen['asks'], readonly GateDecision[]> = {
  answer: ['answered'],
  approve: ['approved', 'redirected'],
  pick: ['picked'],
};
const needsWords: readonly GateDecision[] = ['answered', 'redirected', 'picked'];
const kinds = { approved: 'approve', redirected: 'redirect', picked: 'pick' } as const;

export interface GateClosing {
  decision: GateDecision;
  /** What the person said: the answer, why not, or the choice. */
  words: string;
  by: string;
}

/**
 * The events that close a waiting gate, or why it cannot be closed. The run must be a gate's run still
 * waiting, the decision must fit what it asked, and the person must be one (RB080). An answer's words land
 * as a file of their own (an origin, in the blog), so the ledger records the decision and who made it; any
 * other decision keeps its words in the ledger as feedback.
 */
export function closeGate(
  events: readonly LedgerEvent[],
  closing: GateClosing,
): { ok: true; node: string; bodies: EventBody[] } | { ok: false; error: string } {
  const opened = events.find((e) => e.type === 'gate.opened');
  if (opened?.type !== 'gate.opened') return { ok: false, error: 'This run is not a gate.' };
  const node = opened.node;
  const states = statesOf([{ events }]);
  if (states.get(node) !== 'needs-you')
    return { ok: false, error: `The ${node} gate is already closed.` };
  if (!fits[opened.asks].includes(closing.decision))
    return {
      ok: false,
      error: `The ${node} gate asks to ${opened.asks}; it cannot be ${closing.decision}.`,
    };
  const words = closing.words.trim();
  if (needsWords.includes(closing.decision) && words === '')
    return { ok: false, error: `Say something: ${closing.decision} needs words.` };
  if (!isPerson(closing.by))
    return {
      ok: false,
      error: `RB080: only a person closes a gate, and "${closing.by}" is not one.`,
    };
  const said: EventBody[] =
    closing.decision === 'answered' || words === ''
      ? []
      : [
          {
            type: 'feedback.given',
            node,
            kind: kinds[closing.decision],
            words: closing.words,
            by: closing.by,
          },
        ];
  return {
    ok: true,
    node,
    bodies: [
      ...said,
      { type: 'gate.closed', node, decision: closing.decision, by: closing.by },
      { type: 'node.state', node, from: 'needs-you', to: 'done' },
    ],
  };
}

/**
 * The agents and guards that start now that `finished` is done (a step, or a gate that was closed): each one
 * directly after it whose other recorded steps before it are done too, so a join waits for its last input.
 * One already running is not started again. `runs` are every run on the item, oldest first.
 */
export function stepsToStart(
  workflow: WorkflowInput,
  finished: string,
  runs: readonly { events: readonly LedgerEvent[] }[],
): string[] {
  const states = statesOf(runs);
  if (states.get(finished) !== 'done') return [];
  const recorded = (id: string): boolean => {
    const node = workflow.nodes[id];
    return node !== undefined && !['input', 'tool', 'branch'].includes(node.kind);
  };
  return Object.entries(workflow.nodes).flatMap(([id, node]) => {
    const after = node.after ?? [];
    if ((node.kind !== 'agent' && node.kind !== 'guard') || !after.includes(finished)) return [];
    if (states.get(id) === 'running') return [];
    return after.every((before) => !recorded(before) || states.get(before) === 'done') ? [id] : [];
  });
}

/** The steps a gate looks at: what runs again when its owner sends it back. */
export function stepsBefore(workflow: WorkflowInput, gate: string): string[] {
  return (workflow.nodes[gate]?.after ?? []).filter((id) => {
    const kind = workflow.nodes[id]?.kind;
    return kind === 'agent' || kind === 'guard';
  });
}

/**
 * What the owner last said when sending back a gate directly after `step`, if it came after that step's
 * latest run: the words that step is asked to take into account when it runs again. Null when none.
 */
export function sentBackTo(
  workflow: WorkflowInput,
  step: string,
  runs: readonly { events: readonly LedgerEvent[] }[],
): string | null {
  const gates = new Set(
    Object.entries(workflow.nodes)
      .filter(([, n]) => n.kind === 'gate' && (n.after ?? []).includes(step))
      .map(([id]) => id),
  );
  let words: string | null = null;
  for (const run of runs)
    for (const event of run.events) {
      // A run of the step itself, after the words, has already had them.
      if (event.type === 'node.state' && event.node === step && event.to === 'running')
        words = null;
      if (event.type === 'feedback.given' && event.kind === 'redirect' && gates.has(event.node))
        words = event.words;
    }
  return words;
}
