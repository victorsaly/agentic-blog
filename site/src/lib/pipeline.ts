// Why: one look at where every thought stands: which agents have worked on it, how each one's last run
// ended, and which have not run yet. Read from the ledgers (so as of the last deploy), in the agents' own
// order, phase by phase. Pure, so what a cell says is tested without a build.
import type { Ending, RunRow } from './how-made';

export interface PipelineAgent {
  name: string;
  phase: number;
}

export interface PipelineCell {
  /** The latest run's id; it starts with the moment the run began (20261025T071128Z-…), so ids sort in time. */
  id: string;
  /** How the latest run of this agent on this thought ended. */
  ended: Ending;
  /** The day it started (YYYY-MM-DD). */
  on: string;
  runs: number;
}

export interface PipelineRow {
  slug: string;
  title: string;
  /** One cell per agent, in the agents' order; null where it has never run on this thought. */
  cells: (PipelineCell | null)[];
}

export function pipelineOf(
  thoughts: readonly { slug: string; title: string; rows: readonly RunRow[] }[],
  agents: readonly PipelineAgent[],
): PipelineRow[] {
  return [...thoughts]
    .sort((a, b) => b.slug.localeCompare(a.slug))
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      cells: agents.map((agent) => {
        // Rows come newest first, so the first one is the latest run.
        const own = t.rows.filter((r) => r.agent === agent.name);
        const latest = own[0];
        return latest
          ? { id: latest.id, ended: latest.ended, on: latest.on, runs: own.length }
          : null;
      }),
    }));
}

/** The agents in the order they work: by phase, then by name. */
export function inOrder(agents: readonly PipelineAgent[]): PipelineAgent[] {
  return [...agents].sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name));
}

export interface Standing {
  /** Held: a guard stopped it. Stopped: an agent did not finish. Moving: agents ran, none stopped. */
  state: 'held' | 'stopped' | 'moving' | 'untouched';
  /** The agent that held or did not finish, first in working order. */
  at: string | null;
  /** The latest run on the thought. */
  last: { agent: string; on: string } | null;
  ran: number;
  of: number;
}

/** Where one thought stands, in a line: what stops it (if anything), its latest run, how many agents ran. */
export function standingOf(row: PipelineRow, agents: readonly PipelineAgent[]): Standing {
  const cells = row.cells.map((cell, i) => ({ cell, agent: agents[i]?.name ?? '' }));
  const ran = cells.filter((c) => c.cell !== null);
  const held = ran.find((c) => c.cell?.ended === 'held');
  const stopped = ran.find((c) => c.cell?.ended === 'failed');
  // The latest run is the one that began last: run ids start with their start time, to the second.
  const latest = ran.reduce<(typeof ran)[number] | null>(
    (best, c) => (best === null || (c.cell?.id ?? '') > (best.cell?.id ?? '') ? c : best),
    null,
  );
  return {
    state: held ? 'held' : stopped ? 'stopped' : ran.length > 0 ? 'moving' : 'untouched',
    at: held?.agent ?? stopped?.agent ?? null,
    last: latest?.cell ? { agent: latest.agent, on: latest.cell.on } : null,
    ran: ran.length,
    of: agents.length,
  };
}
