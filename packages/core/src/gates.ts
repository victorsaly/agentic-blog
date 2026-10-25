// Why: a workflow's gates are where a person decides, and until now nothing recorded that one had opened:
// the owner had to know. When a step finishes, this says which gates after it are now waiting, from the
// workflow and the ledger alone, so the runner can open each as a run that waits and the owner sees the
// question where they already look. A gate opens only when everything before it is done, and never twice
// while it is still waiting. Closing one is checked here too: only an open gate, only by a person, and only
// with a decision that answers what it asked. And once a step is done, which steps start next: the run goes
// on by itself, from the workflow and the ledger alone, up to the next gate. It takes the workflow as written
// in the project file. Pure, so the rule is tested here.
import { isPerson, type EventBody, type LedgerEvent, type NodeState } from './ledger.js';
import type { WorkflowInput } from './schema.js';

export interface GateToOpen {
  id: string;
  asks: 'answer' | 'approve' | 'pick';
  question: string;
}

type Runs = readonly { events: readonly LedgerEvent[] }[];

/**
 * Every run's events in the order they happened, by when each was recorded. Run files alone do not say it: a
 * gate's run is opened before the steps after it and closed after them. A tie keeps the order of the files.
 */
function inOrder(runs: Runs): LedgerEvent[] {
  return runs.flatMap((run) => run.events).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Where each node stands (its last recorded state), and when it last changed, as a place in that order. */
function standingOf(runs: Runs): { states: Map<string, NodeState>; changed: Map<string, number> } {
  const states = new Map<string, NodeState>();
  const changed = new Map<string, number>();
  for (const [at, event] of inOrder(runs).entries())
    if (event.type === 'node.state') {
      states.set(event.node, event.to);
      changed.set(event.node, at);
    }
  return { states, changed };
}

const statesOf = (runs: Runs): Map<string, NodeState> => standingOf(runs).states;

const recordedIn =
  (workflow: WorkflowInput) =>
  (id: string): boolean => {
    const node = workflow.nodes[id];
    return node !== undefined && !['input', 'tool', 'branch'].includes(node.kind);
  };

/**
 * Whether a node can start (or a gate open) now: every recorded step before it last ended done, and ended
 * after anything further back last changed. A step done before the step it waits on ran again is old work,
 * so a join waits for its inputs to be redone, and only the last of them to finish starts it.
 */
function readyIn(workflow: WorkflowInput, runs: Runs): (id: string) => boolean {
  const { states, changed } = standingOf(runs);
  const recorded = recordedIn(workflow);
  const back = (id: string, seen = new Set<string>()): string[] =>
    (workflow.nodes[id]?.after ?? []).flatMap((before) => {
      if (seen.has(before)) return [];
      seen.add(before);
      return [before, ...back(before, seen)];
    });
  const current = (id: string): boolean => {
    if (states.get(id) !== 'done') return false;
    const ended = changed.get(id) ?? -1;
    return back(id).every((earlier) => !recorded(earlier) || (changed.get(earlier) ?? -1) < ended);
  };
  return (id) =>
    (workflow.nodes[id]?.after ?? []).every((before) => !recorded(before) || current(before));
}

/**
 * The gates that open now that `finished` is done. `runs` are every run on the item, oldest first, the one
 * that just finished included. A step the ledger does not record (an input, a tool, a branch) never holds a gate back;
 * a step it does record must have last ended done. A gate still waiting is not opened again.
 */
export function gatesToOpen(workflow: WorkflowInput, finished: string, runs: Runs): GateToOpen[] {
  const states = statesOf(runs);
  if (states.get(finished) !== 'done') return [];
  const ready = readyIn(workflow, runs);
  return Object.entries(workflow.nodes).flatMap(([id, node]) => {
    if (node.kind !== 'gate' || !(node.after ?? []).includes(finished)) return [];
    if (states.get(id) === 'needs-you') return [];
    return ready(id) ? [{ id, asks: node.asks, question: node.question }] : [];
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
 * directly after it whose other recorded steps before it are done too, and done since anything they wait on
 * last changed, so a join waits for its last input of this pass and starts once. One already running is not
 * started again. `runs` are every run on the item.
 */
export function stepsToStart(workflow: WorkflowInput, finished: string, runs: Runs): string[] {
  const states = statesOf(runs);
  if (states.get(finished) !== 'done') return [];
  const ready = readyIn(workflow, runs);
  return Object.entries(workflow.nodes).flatMap(([id, node]) => {
    if ((node.kind !== 'agent' && node.kind !== 'guard') || !(node.after ?? []).includes(finished))
      return [];
    if (states.get(id) === 'running') return [];
    return ready(id) ? [id] : [];
  });
}

/**
 * Whether approving `gate` lets the work out: a gate directly before the workflow's way out (a sink). Its
 * owner approving it is the merge, so the runtime may carry it out on their word, and only on it.
 */
export function leadsOut(workflow: WorkflowInput, gate: string): boolean {
  return (
    workflow.nodes[gate]?.kind === 'gate' &&
    Object.values(workflow.nodes).some((n) => n.kind === 'sink' && (n.after ?? []).includes(gate))
  );
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
 * latest run started: the words that step is asked to take into account when it runs again. Null when none.
 * Read in the order things happened, since the words land in the gate's run, which may be older than the
 * step's latest run.
 */
export function sentBackTo(workflow: WorkflowInput, step: string, runs: Runs): string | null {
  const gates = new Set(
    Object.entries(workflow.nodes)
      .filter(([, n]) => n.kind === 'gate' && (n.after ?? []).includes(step))
      .map(([id]) => id),
  );
  let words: string | null = null;
  for (const event of inOrder(runs)) {
    // A run of the step itself, after the words, has already had them.
    if (event.type === 'node.state' && event.node === step && event.to === 'running') words = null;
    if (event.type === 'feedback.given' && event.kind === 'redirect' && gates.has(event.node))
      words = event.words;
  }
  return words;
}
