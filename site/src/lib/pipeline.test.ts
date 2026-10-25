// Why: the pipeline is where Victor sees what is left to do on a thought; a cell showing an old run as the
// latest, or a gap where an agent did run, would point him at the wrong work.
import { describe, expect, it } from 'vitest';
import { inOrder, pipelineOf } from './pipeline.js';
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
