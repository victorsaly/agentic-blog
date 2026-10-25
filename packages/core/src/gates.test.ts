// Why: a gate that opens too early asks Victor about work that is not finished; one that opens twice asks
// him the same question twice; one that never opens leaves the thought stuck with nobody told.
import { describe, expect, it } from 'vitest';
import {
  closeGate,
  gatesToOpen,
  leadsOut,
  stillReady,
  sentBackTo,
  stepsBefore,
  stepsToStart,
} from './gates.js';
import { Ledger, type EventBody } from './ledger.js';
import type { WorkflowInput } from './schema.js';

// Cards are left out: deciding when a gate opens reads only the shape of the workflow.
const workflow = {
  id: 'w',
  why: 'A workflow with two gates, one after one step and one after two.',
  nodes: {
    origin: { kind: 'input', why: 'Where it starts.', accepts: ['text'] },
    interview: { kind: 'agent', why: 'Asks.', after: ['origin'] },
    answers: {
      kind: 'gate',
      why: 'Only the owner can answer.',
      after: ['interview', 'origin'],
      asks: 'answer',
      question: 'Answer the questions.',
    },
    convert: { kind: 'agent', why: 'Writes.', after: ['answers'] },
    image: { kind: 'agent', why: 'Draws.', after: ['answers'] },
    look: {
      kind: 'gate',
      why: 'The owner looks at both.',
      after: ['convert', 'image'],
      asks: 'approve',
      question: 'Is this right?',
    },
  },
} as unknown as WorkflowInput;

// One clock for every run in a file, a second a tick, so the order things happened is never a tie.
let tick = 0;
const now = (): Date => new Date(Date.UTC(2026, 9, 25, 9, 0, tick++));

async function run(...bodies: EventBody[]): Promise<{ events: Ledger['events'] }> {
  const ledger = new Ledger({ now });
  for (const body of bodies) await ledger.append(body);
  return { events: ledger.events };
}
const ran = (node: string, to: 'done' | 'held' | 'failed' = 'done') =>
  run(
    { type: 'node.state', node, from: 'idle', to: 'running' },
    { type: 'node.state', node, from: 'running', to },
  );
const opened = (node: string) => run({ type: 'node.state', node, from: 'idle', to: 'needs-you' });

describe('gatesToOpen', () => {
  it('opens the gate after a finished step, with its question; an input never holds it back', async () => {
    expect(gatesToOpen(workflow, 'interview', [await ran('interview')])).toEqual([
      { id: 'answers', asks: 'answer', question: 'Answer the questions.' },
    ]);
  });

  it('opens nothing when the step did not end done', async () => {
    expect(gatesToOpen(workflow, 'interview', [await ran('interview', 'held')])).toEqual([]);
    expect(gatesToOpen(workflow, 'interview', [await ran('interview', 'failed')])).toEqual([]);
  });

  it('waits until every step before the gate is done', async () => {
    expect(gatesToOpen(workflow, 'convert', [await ran('convert')])).toEqual([]);
    expect(
      gatesToOpen(workflow, 'convert', [await ran('image'), await ran('convert')]).map((g) => g.id),
    ).toEqual(['look']);
  });

  it('counts only the latest run of a step: a later failure holds the gate back again', async () => {
    const runs = [await ran('image'), await ran('image', 'failed'), await ran('convert')];
    expect(gatesToOpen(workflow, 'convert', runs)).toEqual([]);
  });

  it('never opens a gate that is still waiting, but opens it again once it was closed', async () => {
    const waiting = [await ran('interview'), await opened('answers'), await ran('interview')];
    expect(gatesToOpen(workflow, 'interview', waiting)).toEqual([]);
    const closed = await run(
      { type: 'node.state', node: 'answers', from: 'idle', to: 'needs-you' },
      { type: 'node.state', node: 'answers', from: 'needs-you', to: 'done' },
    );
    expect(
      gatesToOpen(workflow, 'interview', [await ran('interview'), closed, await ran('interview')]),
    ).toHaveLength(1);
  });
});

describe('closeGate', () => {
  const waiting = (asks: 'answer' | 'approve') =>
    run(
      { type: 'run.started', workflow: 'w', origin: 'o', by: 'local' },
      { type: 'node.state', node: 'g', from: 'idle', to: 'needs-you' },
      { type: 'gate.opened', node: 'g', asks, question: 'Well?' },
    );
  const by = 'info@victorsaly.com';

  it('closes an answer with who decided and done; the words land elsewhere, as a file', async () => {
    const closing = closeGate((await waiting('answer')).events, {
      decision: 'answered',
      words: 'Here.',
      by,
    });
    expect(closing).toEqual({
      ok: true,
      node: 'g',
      bodies: [
        { type: 'gate.closed', node: 'g', decision: 'answered', by },
        { type: 'node.state', node: 'g', from: 'needs-you', to: 'done' },
      ],
    });
  });

  it('keeps the words of a send-back in the ledger, as feedback', async () => {
    const closing = closeGate((await waiting('approve')).events, {
      decision: 'redirected',
      words: 'The message is the second idea, not the first.',
      by,
    });
    expect(closing.ok && closing.bodies[0]).toMatchObject({
      type: 'feedback.given',
      kind: 'redirect',
    });
  });

  it('refuses what cannot stand, each with a plain reason', async () => {
    const reason = (closing: ReturnType<typeof closeGate>): string =>
      closing.ok ? 'it closed' : closing.error;
    const answer = (await waiting('answer')).events;
    expect(reason(closeGate(answer, { decision: 'approved', words: '', by }))).toMatch(
      /asks to answer/,
    );
    expect(reason(closeGate(answer, { decision: 'answered', words: '  ', by }))).toMatch(
      /needs words/,
    );
    expect(
      reason(closeGate(answer, { decision: 'answered', words: 'x', by: 'structure' })),
    ).toMatch(/RB080/);
    expect(
      reason(closeGate((await ran('interview')).events, { decision: 'answered', words: 'x', by })),
    ).toBe('This run is not a gate.');
    const closed = await run(
      { type: 'node.state', node: 'g', from: 'idle', to: 'needs-you' },
      { type: 'gate.opened', node: 'g', asks: 'answer', question: 'Well?' },
      { type: 'gate.closed', node: 'g', decision: 'answered', by },
      { type: 'node.state', node: 'g', from: 'needs-you', to: 'done' },
    );
    expect(reason(closeGate(closed.events, { decision: 'answered', words: 'again', by }))).toMatch(
      /already closed/,
    );
  });
});

describe('the run goes on', () => {
  const closedGate = (node: string) =>
    run(
      { type: 'node.state', node, from: 'idle', to: 'needs-you' },
      { type: 'node.state', node, from: 'needs-you', to: 'done' },
    );

  it('starts every step after a closed gate', async () => {
    expect(
      stepsToStart(workflow, 'answers', [await ran('interview'), await closedGate('answers')]),
    ).toEqual(['convert', 'image']);
  });

  it('starts nothing after a gate still waiting, or a step that did not finish', async () => {
    expect(stepsToStart(workflow, 'answers', [await opened('answers')])).toEqual([]);
    expect(stepsToStart(workflow, 'interview', [await ran('interview', 'held')])).toEqual([]);
  });

  it('never starts a gate, and never starts a step that is running already', async () => {
    const both = [await closedGate('answers'), await ran('convert')];
    expect(stepsToStart(workflow, 'convert', both)).toEqual([]);
    const running = await run({ type: 'node.state', node: 'image', from: 'idle', to: 'running' });
    expect(stepsToStart(workflow, 'answers', [await closedGate('answers'), running])).toEqual([
      'convert',
    ]);
  });

  it('runs the steps before a gate again when it is sent back', () => {
    expect(stepsBefore(workflow, 'look')).toEqual(['convert', 'image']);
    expect(stepsBefore(workflow, 'answers')).toEqual(['interview']);
  });

  it('hands the sent-back words to the step before the gate, once', async () => {
    const before = await ran('interview');
    const said = await run(
      { type: 'node.state', node: 'answers', from: 'idle', to: 'needs-you' },
      {
        type: 'feedback.given',
        node: 'answers',
        kind: 'redirect',
        words: 'Not this.',
        by: 'owner',
      },
    );
    expect(sentBackTo(workflow, 'interview', [before, said])).toBe('Not this.');
    expect(sentBackTo(workflow, 'convert', [before, said])).toBeNull();
    expect(sentBackTo(workflow, 'interview', [before, said, await ran('interview')])).toBeNull();
  });

  it('reads the words in the order they were said, not the order of the run files', async () => {
    // The gate opened, then interview ran again while it waited, then the owner sent the gate back: the
    // words are in the gate's run, the older file, but came last.
    const gate = new Ledger({ now });
    await gate.append({ type: 'node.state', node: 'answers', from: 'idle', to: 'needs-you' });
    const rerun = await ran('interview');
    await gate.append({
      type: 'feedback.given',
      node: 'answers',
      kind: 'redirect',
      words: 'Ask about the second idea.',
      by: 'owner',
    });
    expect(sentBackTo(workflow, 'interview', [{ events: gate.events }, rerun])).toBe(
      'Ask about the second idea.',
    );
  });

  it('runs again only what follows a step that ran again: a join waits for its inputs to be redone', async () => {
    // convert feeds proof and review; review also waits for proof, so a new convert makes proof old work.
    const join = {
      id: 'j',
      why: 'A join after a step and the step after it.',
      nodes: {
        convert: { kind: 'agent', why: 'Writes.' },
        proof: { kind: 'agent', why: 'Checks.', after: ['convert'] },
        review: { kind: 'guard', why: 'Looks at both.', after: ['convert', 'proof'] },
      },
    } as unknown as WorkflowInput;
    const first = [await ran('convert'), await ran('proof')];
    expect(stepsToStart(join, 'proof', first)).toEqual(['review']);
    const again = [...first, await ran('review'), await ran('convert')];
    expect(stepsToStart(join, 'convert', again)).toEqual(['proof']);
    expect(stepsToStart(join, 'proof', [...again, await ran('proof')])).toEqual(['review']);
  });
});

describe('the way out', () => {
  it('lets only the gate directly before the way out merge on its approval', () => {
    const out = {
      id: 'o',
      why: 'A gate, then the way out.',
      nodes: {
        write: { kind: 'agent', why: 'Writes.' },
        look: { kind: 'gate', why: 'Owner.', after: ['write'], asks: 'approve', question: 'Ok?' },
        merge: { kind: 'gate', why: 'Owner.', after: ['look'], asks: 'approve', question: 'Live?' },
        live: { kind: 'sink', why: 'Out.', after: ['merge'] },
      },
    } as unknown as WorkflowInput;
    expect(leadsOut(out, 'merge')).toBe(true);
    expect(leadsOut(out, 'look')).toBe(false);
    expect(leadsOut(out, 'write')).toBe(false);
    expect(leadsOut(workflow, 'look')).toBe(false);
  });

  it('calls an open gate stale once a step before it holds, until it is done again', async () => {
    const runs = [await ran('convert'), await ran('image'), await opened('look')];
    expect(stillReady(workflow, 'look', runs)).toBe(true);
    const held = [...runs, await ran('image', 'held')];
    expect(stillReady(workflow, 'look', held)).toBe(false);
    expect(stillReady(workflow, 'look', [...held, await ran('image')])).toBe(true);
  });
});
