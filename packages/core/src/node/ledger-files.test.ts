// Why: the runner and CI both trust this reader, so it must pass untouched runs, catch an edited line, a cut
// end and a missing half, never overwrite a run, and never mistake an unreadable folder for an empty one.
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Ledger, hashOf } from '../ledger.js';
import {
  extendRun,
  isLedgerPath,
  readRuns,
  runId,
  saveRun,
  verifyRunText,
} from './ledger-files.js';

async function finishedRun(): Promise<Ledger> {
  const ledger = new Ledger();
  await ledger.append({ type: 'run.started', workflow: 'blog-post', origin: 'o', by: 'local' });
  await ledger.append({ type: 'node.state', node: 'safety', from: 'idle', to: 'running' });
  await ledger.append({ type: 'node.state', node: 'safety', from: 'running', to: 'done' });
  return ledger;
}

async function thoughtWithRuns(...ids: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ledger-'));
  for (const id of ids) await saveRun(dir, id, await finishedRun());
  return dir;
}

describe('readRuns', () => {
  it('reads every run oldest first, and a thought with no ledger as no runs', async () => {
    const dir = await thoughtWithRuns('20261024T120000Z-seo-bbbb', '20261023T090000Z-safety-aaaa');
    const { runs, issues } = await readRuns(dir);
    expect(issues).toEqual([]);
    expect(runs.map((r) => r.id)).toEqual([
      '20261023T090000Z-safety-aaaa',
      '20261024T120000Z-seo-bbbb',
    ]);
    expect(await readRuns(await mkdtemp(join(tmpdir(), 'empty-')))).toEqual({
      runs: [],
      issues: [],
    });
  });

  it('names a run whose past line was edited or whose end was cut off', async () => {
    const dir = await thoughtWithRuns('a', 'b');
    const a = join(dir, 'ledger', 'a.jsonl');
    await writeFile(a, (await readFile(a, 'utf8')).replace('"to":"running"', '"to":"held"'));
    const b = join(dir, 'ledger', 'b.jsonl');
    await writeFile(b, (await readFile(b, 'utf8')).split('\n').slice(0, 2).join('\n'));
    const { runs, issues } = await readRuns(dir, 'thoughts/x');
    expect(runs).toEqual([]);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('thoughts/x/ledger/a: the run does not verify from event 1');
    expect(issues[1]).toContain('thoughts/x/ledger/b: the run does not verify from event 2');
  });

  it('throws when the ledger folder cannot be read, rather than finding nothing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'broken-'));
    await writeFile(join(dir, 'ledger'), 'not a folder');
    await expect(readRuns(dir)).rejects.toThrow();
  });

  it('flags a stray file in the ledger folder', async () => {
    const dir = await thoughtWithRuns('a');
    await mkdir(join(dir, 'ledger'), { recursive: true });
    await writeFile(join(dir, 'ledger', 'notes.txt'), 'hi');
    expect((await readRuns(dir, 'thoughts/x')).issues).toEqual([
      'thoughts/x/ledger/notes.txt: not part of a run. Fix: move it out.',
    ]);
  });
});

describe('saveRun', () => {
  it('never replaces a run already written', async () => {
    const dir = await thoughtWithRuns('a');
    await expect(saveRun(dir, 'a', await finishedRun())).rejects.toThrow();
  });
});

describe('verifyRunText', () => {
  it('names the missing half', async () => {
    const ledger = await finishedRun();
    expect(await verifyRunText('t/ledger/a', 'x', null)).toEqual([
      't/ledger/a.jsonl has no t/ledger/a.head. Fix: restore the head from git.',
    ]);
    expect(await verifyRunText('t/ledger/a', null, JSON.stringify(ledger.head))).toHaveLength(1);
  });
});

describe('extendRun', () => {
  it('carries a saved run on, and the result still verifies', async () => {
    const dir = await thoughtWithRuns('20261025T120000Z-answers-aaaa');
    const [saved] = (await readRuns(dir)).runs;
    if (!saved) throw new Error('no run');
    const last = saved.events.at(-1);
    const ledger = await Ledger.resume(saved.events, {
      count: saved.events.length,
      hash: last?.hash ?? '',
    });
    await ledger.append({
      type: 'gate.closed',
      node: 'answers',
      decision: 'answered',
      by: 'owner',
    });
    await extendRun(dir, saved.id, ledger);
    const { runs, issues } = await readRuns(dir);
    expect(issues).toEqual([]);
    expect(runs[0]?.events).toHaveLength(saved.events.length + 1);
  });

  it('refuses to carry on a saved run that was cut short or changed, and writes nothing', async () => {
    const id = '20261025T120000Z-answers-aaaa';
    const dir = await thoughtWithRuns(id);
    const [saved] = (await readRuns(dir)).runs;
    if (!saved) throw new Error('no run');
    const last = saved.events.at(-1);
    const ledger = await Ledger.resume(saved.events, {
      count: saved.events.length,
      hash: last?.hash ?? '',
    });
    await ledger.append({
      type: 'gate.closed',
      node: 'answers',
      decision: 'answered',
      by: 'owner',
    });
    // Cut the saved file to its first event: every hash still matches the new run, but the head says more.
    const file = join(dir, 'ledger', `${id}.jsonl`);
    const cut = (await readFile(file, 'utf8')).split('\n').slice(0, 1).join('\n');
    await writeFile(file, `${cut}\n`);
    await expect(extendRun(dir, id, ledger)).rejects.toThrow(/does not verify/);
    expect(await readFile(file, 'utf8')).toBe(`${cut}\n`);
  });

  it('refuses a run that is not the saved one carried on, and writes nothing', async () => {
    const dir = await thoughtWithRuns('20261025T120000Z-answers-aaaa');
    const other = new Ledger();
    await other.append({
      type: 'run.started',
      workflow: 'blog-post',
      origin: 'elsewhere',
      by: 'local',
    });
    await expect(extendRun(dir, '20261025T120000Z-answers-aaaa', other)).rejects.toThrow(
      /not the start/,
    );
    expect((await readRuns(dir)).issues).toEqual([]);
  });
});

describe('RB080 on reading', () => {
  it('refuses a gate closed by an agent even when its hash is good, as if written by hand', async () => {
    const head = {
      type: 'gate.closed',
      node: 'message',
      decision: 'approved',
      by: 'structure',
      seq: 0,
      at: '2026-10-25T12:00:00.000Z',
      prev: '0'.repeat(64),
    };
    const hash = await hashOf(head);
    const issues = await verifyRunText(
      'thoughts/t/ledger/20261025T120000Z-message-abcd',
      `${JSON.stringify({ ...head, hash })}\n`,
      JSON.stringify({ count: 1, hash }),
    );
    expect(issues).toEqual([expect.stringMatching(/event 0 is refused: RB080/)]);
  });
});

describe('runId and isLedgerPath', () => {
  it('sorts by start time and names the agent', () => {
    const id = runId(new Date('2026-10-24T10:15:30.123Z'), 'seo');
    expect(id).toMatch(/^20261024T101530Z-seo-[0-9a-f]{4}$/);
  });

  it('knows a ledger path from the thought or from the repo', () => {
    expect(isLedgerPath('ledger/a.jsonl')).toBe(true);
    expect(isLedgerPath('thoughts/x/ledger/a.head')).toBe(true);
    expect(isLedgerPath('versions/ledger.md')).toBe(false);
  });
});
