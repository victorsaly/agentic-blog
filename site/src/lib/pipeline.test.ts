// Why: the pipeline is where Victor sees what is left to do on a thought; a cell showing an old run as the
// latest, or a gap where an agent did run, would point him at the wrong work.
import { describe, expect, it } from 'vitest';
import { inOrder, pipelineOf, standingOf, withLive, type LiveCell } from './pipeline.js';
import type { RunRow } from './how-made.js';

const row = (id: string, agent: string, ended: RunRow['ended']): RunRow => ({
  id,
  agent,
  on: '2026-10-25',
  ended,
  usd: 0,
  costed: true,
});

describe('pipelineOf', () => {
  const agents = inOrder([
    { name: 'voice', phase: 4 },
    { name: 'structure', phase: 2 },
    { name: 'interview', phase: 1 },
  ]);

  it('puts the agents in working order', () => {
    expect(agents.map((a) => a.name)).toEqual(['interview', 'structure', 'voice']);
  });

  it('shows the latest run of each agent, how many there were, and a gap where none ran', () => {
    const [only] = pipelineOf(
      [
        {
          slug: '2026-10-23-a',
          title: 'A',
          // newest first, as runRows gives them
          rows: [row('2', 'structure', 'done'), row('1', 'structure', 'held')],
        },
      ],
      agents,
    );
    expect(only?.cells).toEqual([
      null,
      { id: '2', ended: 'done', on: '2026-10-25', runs: 2 },
      null,
    ]);
  });

  it('lists the newest thought first', () => {
    const rows = pipelineOf(
      [
        { slug: '2026-10-22-old', title: 'Old', rows: [] },
        { slug: '2026-10-24-new', title: 'New', rows: [] },
      ],
      agents,
    );
    expect(rows.map((r) => r.title)).toEqual(['New', 'Old']);
  });
});

describe('standingOf', () => {
  const agents = inOrder([
    { name: 'structure', phase: 2 },
    { name: 'safety', phase: 5 },
    { name: 'security', phase: 5 },
    { name: 'voice', phase: 5 },
  ]);
  const cell = (ended: RunRow['ended'], on: string, at = '000000') => ({
    id: `${on.replaceAll('-', '')}T${at}Z-x`,
    ended,
    on,
    runs: 1,
  });

  it('names the guard that holds a thought before anything else', () => {
    const standing = standingOf(
      {
        slug: 's',
        title: 'T',
        cells: [
          cell('done', '2026-10-23'),
          cell('done', '2026-10-25', '090000'),
          cell('held', '2026-10-25', '091000'),
          cell('done', '2026-10-25', '092000'),
        ],
      },
      agents,
    );
    expect(standing).toEqual({
      state: 'held',
      at: 'security',
      last: { agent: 'voice', on: '2026-10-25' },
      ran: 4,
      of: 4,
    });
  });

  it('says an agent did not finish when nothing holds, and moving when all went through', () => {
    const row = (ended: RunRow['ended']) => ({
      slug: 's',
      title: 'T',
      cells: [cell(ended, '2026-10-24'), null, null, null],
    });
    expect(standingOf(row('failed'), agents)).toMatchObject({
      state: 'stopped',
      at: 'structure',
      ran: 1,
    });
    expect(standingOf(row('done'), agents)).toMatchObject({ state: 'moving', at: null });
  });

  it('orders runs on the same day by when they began, not by working order', () => {
    // Voice ran at 09:00, then Structure, earlier in working order, was run again at 10:00.
    const standing = standingOf(
      {
        slug: 's',
        title: 'T',
        cells: [
          cell('done', '2026-10-25', '100000'),
          null,
          null,
          cell('done', '2026-10-25', '090000'),
        ],
      },
      agents,
    );
    expect(standing.last).toEqual({ agent: 'structure', on: '2026-10-25' });
  });

  it('knows a thought no agent has touched', () => {
    expect(standingOf({ slug: 's', title: 'T', cells: [null, null, null, null] }, agents)).toEqual({
      state: 'untouched',
      at: null,
      last: null,
      ran: 0,
      of: 4,
    });
  });
});

describe('withLive', () => {
  const agents = inOrder([
    { name: 'structure', phase: 2 },
    { name: 'safety', phase: 3 },
  ]);
  const built = pipelineOf(
    [
      {
        slug: '2026-10-23-a',
        title: 'A',
        rows: [row('20261025T090000Z-structure-0001', 'structure', 'done')],
      },
    ],
    agents,
  );
  const live = (over: Partial<LiveCell>): LiveCell => ({
    id: '20261025T120000Z-safety-0002',
    thought: '2026-10-23-a',
    agent: 'safety',
    state: 'running',
    startedAt: '2026-10-25T12:00:00Z',
    runs: 1,
    ...over,
  });

  it('fills a cell the deploy has not seen, and the thought reads as running there', () => {
    const [a] = withLive(built, [live({})], agents);
    expect(a?.cells[1]).toEqual({
      id: '20261025T120000Z-safety-0002',
      ended: 'running',
      on: '2026-10-25',
      runs: 1,
    });
    expect(a && standingOf(a, agents)).toMatchObject({ state: 'running', at: 'safety' });
  });

  it('keeps the ledger cell when the live copy only knows an older run', () => {
    const [a] = withLive(
      built,
      [live({ id: '20261024T090000Z-structure-0000', agent: 'structure', state: 'held' })],
      agents,
    );
    expect(a?.cells[0]?.ended).toBe('done');
  });

  it('takes the newer live run and counts every run either side knows', () => {
    const [a] = withLive(
      built,
      [live({ id: '20261025T130000Z-structure-0003', agent: 'structure', state: 'held', runs: 2 })],
      agents,
    );
    expect(a?.cells[0]).toMatchObject({ ended: 'held', runs: 2 });
    expect(a && standingOf(a, agents).state).toBe('held');
  });

  it('adds a thought the deploy has not seen yet, under its folder name, newest first', () => {
    const rows = withLive(built, [live({ thought: '2026-10-25-new' })], agents);
    expect(rows.map((r) => [r.slug, r.title])).toEqual([
      ['2026-10-25-new', '2026-10-25-new'],
      ['2026-10-23-a', 'A'],
    ]);
  });
});
