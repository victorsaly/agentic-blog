// Why: a gate that opens too early asks Victor about work that is not finished; one that opens twice asks
// him the same question twice; one that never opens leaves the thought stuck with nobody told.
import { describe, expect, it } from 'vitest';
import { closeGate, gatesToOpen } from './gates.js';
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

async function run(...bodies: EventBody[]): Promise<{ events: Ledger['events'] }> {
  const ledger = new Ledger();
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
