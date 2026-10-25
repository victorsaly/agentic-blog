// Why: the lock is what keeps two runs on one thought from opening the same gate twice; if two holders could
// overlap, or a dead runner's lock blocked every run after it, the gate would open twice or never.
import { mkdir, mkdtemp, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Ledger, gatesToOpen, type WorkflowInput } from '@roadbook/core';
import { readRuns, runId, saveRun } from '@roadbook/core/node';
import { gateOpening } from './record.js';
import { withLock } from './lock.js';

const wait = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

describe('withLock', () => {
  it('lets one holder in at a time', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lock-'));
    const order: string[] = [];
    const hold = (who: string) =>
      withLock(
        'thought',
        async () => {
          order.push(`${who} in`);
          await wait(30);
          order.push(`${who} out`);
        },
        { dir },
      );
    await Promise.all([hold('a'), hold('b')]);
    expect(order).toEqual(
      order[0] === 'a in' ? ['a in', 'a out', 'b in', 'b out'] : ['b in', 'b out', 'a in', 'a out'],
    );
  });

  it('takes back a lock left by a runner that stopped', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lock-'));
    const name = createHash('sha256').update('thought').digest('hex').slice(0, 16);
    const left = join(dir, `roadbook-${name}.lock`);
    await mkdir(left);
    const old = new Date(Date.now() - 120_000);
    await utimes(left, old, old);
    await expect(withLock('thought', () => Promise.resolve('ran'), { dir })).resolves.toBe('ran');
  });

  it('keeps two runners deciding at once from opening the same gate twice', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lock-'));
    const thought = await mkdtemp(join(tmpdir(), 'thought-'));
    const workflow = {
      id: 'w',
      why: 'One gate after one step.',
      nodes: {
        interview: { kind: 'agent', why: 'Asks.' },
        answers: {
          kind: 'gate',
          why: 'Only the owner answers.',
          after: ['interview'],
          asks: 'answer',
          question: 'Answer them.',
        },
      },
    } as unknown as WorkflowInput;
    const done = new Ledger();
    await done.append({ type: 'node.state', node: 'interview', from: 'idle', to: 'running' });
    await done.append({ type: 'node.state', node: 'interview', from: 'running', to: 'done' });
    await saveRun(thought, runId(new Date(), 'interview'), done);

    const decide = () =>
      withLock(
        thought,
        async () => {
          const { runs } = await readRuns(thought);
          for (const gate of gatesToOpen(workflow, 'interview', runs)) {
            const ledger = new Ledger();
            for (const body of gateOpening(gate, 'o', 'local')) await ledger.append(body);
            await saveRun(thought, runId(new Date(), gate.id), ledger);
          }
        },
        { dir },
      );
    await Promise.all([decide(), decide()]);
    const { runs } = await readRuns(thought);
    expect(runs.filter((r) => r.id.includes('-answers-'))).toHaveLength(1);
  });
});
