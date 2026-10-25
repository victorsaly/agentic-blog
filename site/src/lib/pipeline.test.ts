// Why: the pipeline is where Victor sees what is left to do on a thought; a cell showing an old run as the
// latest, or a gap where an agent did run, would point him at the wrong work.
import { describe, expect, it } from 'vitest';
import { inOrder, pipelineOf, standingOf } from './pipeline.js';
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
    expect(only?.cells).toEqual([null, { ended: 'done', on: '2026-10-25', runs: 2 }, null]);
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
  const cell = (ended: RunRow['ended'], on: string) => ({ ended, on, runs: 1 });

  it('names the guard that holds a thought before anything else', () => {
    const standing = standingOf(
      {
        slug: 's',
        title: 'T',
        cells: [
          cell('done', '2026-10-23'),
          cell('done', '2026-10-25'),
          cell('held', '2026-10-25'),
          cell('done', '2026-10-25'),
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
