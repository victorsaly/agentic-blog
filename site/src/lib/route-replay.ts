// Why: /how-it-works shows a real thought going down the route, not a drawing of how it might. This turns a
// thought's ledger into the frames of that picture: every change of state in the order it happened, what it
// was in plain words, and every step's state after it, as the studio draws them. Changes a few seconds apart
// are one moment (an agent finishing and the next one starting), so the replay moves at reading pace, and a
// long real wait (a person answering) holds a little longer than a quick one. It ends where the post went
// live, so a run after that never leaves the picture looking unfinished. Pure, read at build time.
import { layoutOf, routeOf, type RouteLayout, type StepState } from '@roadbook/core/route';
import type { LedgerEvent, NodeState, WorkflowInput } from '@roadbook/core';
import { agentName } from './agent-runs';

export interface ReplayFrame {
  /** Whole minutes since the first step started. */
  minute: number;
  /** What happened at this moment, in words. */
  said: string;
  /** Every step's state once it had happened. */
  states: Record<string, StepState>;
  /** How long the frame stays up while playing, in milliseconds. */
  hold: number;
}

export interface Replay {
  layout: RouteLayout;
  frames: ReplayFrame[];
  /** How many times a person was asked, and how many steps had to be run again. */
  asked: number;
  again: number;
}

/** Changes closer together than this are one moment. */
const MOMENT_MS = 5000;
const HOLD_MS = 320;
/** A real second adds this much to a frame, up to HOLD_LONGEST_MS more. */
const HOLD_PER_SECOND = 4;
const HOLD_LONGEST_MS = 900;

interface Change {
  at: number;
  node: string;
  from: NodeState;
  to: NodeState;
}

function phrase(
  change: Change,
  node: WorkflowInput['nodes'][string] | undefined,
  person: string,
): string | null {
  const name = agentName(change.node);
  if (node?.kind === 'gate') {
    if (change.to === 'needs-you') return `Waiting for ${person}: ${node.question}`;
    if (change.to === 'done')
      return node.asks === 'answer' ? `${person} answered.` : `${person} approved.`;
    return null;
  }
  switch (change.to) {
    case 'running':
      if (change.from === 'failed') return `${name} is run again.`;
      return change.from === 'done' ? `${name} runs again.` : `${name} starts.`;
    case 'waiting':
      return `${name} waits its turn.`;
    case 'done':
      return `${name} is done.`;
    case 'held':
      return `${name} holds the post.`;
    case 'failed':
      return `${name} did not finish.`;
    default:
      return null;
  }
}

/** The replay of one thought's runs on a workflow's route; `person` is who answers its gates. */
export function replayOf(
  workflow: WorkflowInput,
  runs: readonly { events: readonly LedgerEvent[] }[],
  person: string,
): Replay {
  const layout = layoutOf(workflow);
  const changes: Change[] = runs
    .flatMap((run) => run.events)
    .flatMap((e) =>
      e.type === 'node.state'
        ? [{ at: Date.parse(e.at), node: e.node, from: e.from, to: e.to }]
        : [],
    )
    .sort((a, b) => a.at - b.at);
  const sinks = layout.steps.filter((s) => s.kind === 'sink').map((s) => s.id);
  const known = new Map<string, NodeState>();
  const frames: (ReplayFrame & { at: number })[] = [];
  const start = changes[0]?.at ?? 0;
  let asked = 0;
  let again = 0;
  for (const change of changes) {
    known.set(change.node, change.to);
    const node = workflow.nodes[change.node];
    if (node?.kind === 'gate' && change.to === 'needs-you') asked++;
    if (change.from === 'failed' && change.to === 'running') again++;
    const said = phrase(change, node, person);
    const states = routeOf(layout, known).states;
    const open = frames.at(-1);
    if (open && change.at - open.at < MOMENT_MS) {
      open.states = states;
      if (said) open.said = open.said ? `${open.said} ${said}` : said;
    } else {
      frames.push({
        at: change.at,
        minute: Math.floor((change.at - start) / 60_000),
        said: said ?? '',
        states,
        hold: 0,
      });
    }
    if (sinks.length > 0 && sinks.every((s) => states[s] === 'done')) break;
  }
  return {
    layout,
    frames: frames.map(({ at, ...frame }, i) => {
      const next = frames[i + 1];
      const gap = next ? (next.at - at) / 1000 : 0;
      return {
        ...frame,
        hold: next ? HOLD_MS + Math.min(HOLD_LONGEST_MS, gap * HOLD_PER_SECOND) : 0,
      };
    }),
    asked,
    again,
  };
}
