// Why: one look at where every thought stands: which agents have worked on it, how each one's last run
// ended, and which have not run yet, in the agents' own order, phase by phase. Built from the ledgers (as of
// the last deploy), then brought up to date from the runner's live copy, so a run on Victor's computer moves
// its thought's line while it happens. Pure, so what a cell says is tested without a build.
import type { Ending, RunRow } from './how-made';

/** How a cell's latest run stands: how it ended, or that it is waiting on Victor (from the live copy). */
export type CellEnding = Ending | 'waiting';

export interface PipelineAgent {
  name: string;
  phase: number;
}

export interface PipelineCell {
  /** The latest run's id; it starts with the moment the run began (20261025T071128Z-…), so ids sort in time. */
  id: string;
  /** How the latest run of this agent on this thought ended, or that it waits on Victor. */
  ended: CellEnding;
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
  /**
   * Held: a guard stopped it. Stopped: an agent did not finish. Waiting: a run is waiting on Victor.
   * Running: an agent is at work on it now. Moving: agents ran, none stopped.
   */
  state: 'held' | 'stopped' | 'waiting' | 'running' | 'moving' | 'untouched';
  /** The agent that held, did not finish, waits, or is running, first in working order. */
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
  const waiting = ran.find((c) => c.cell?.ended === 'waiting');
  const running = ran.find((c) => c.cell?.ended === 'running');
  // The latest run is the one that began last: run ids start with their start time, to the second.
  const latest = ran.reduce<(typeof ran)[number] | null>(
    (best, c) => (best === null || (c.cell?.id ?? '') > (best.cell?.id ?? '') ? c : best),
    null,
  );
  return {
    state: held
      ? 'held'
      : stopped
        ? 'stopped'
        : waiting
          ? 'waiting'
          : running
            ? 'running'
            : ran.length > 0
              ? 'moving'
              : 'untouched',
    at: held?.agent ?? stopped?.agent ?? waiting?.agent ?? running?.agent ?? null,
    last: latest?.cell ? { agent: latest.agent, on: latest.cell.on } : null,
    ran: ran.length,
    of: agents.length,
  };
}

/** Each agent's latest run on a thought, from the live copy, with how many runs it has made there. */
export interface LiveCell {
  id: string;
  thought: string;
  agent: string;
  /** The state its run last moved to: running, needs-you, done, held or failed. */
  state: string;
  startedAt: string;
  runs: number;
}

/**
 * A live state as the pipeline shows it. Only a run at work is Running: one waiting on Victor says so, and
 * one that ended idle (an agent not built yet) is Not run, as the ledgers say it.
 */
const endingOfState = (state: string): CellEnding =>
  state === 'done' || state === 'held' || state === 'failed' || state === 'running'
    ? state
    : state === 'needs-you'
      ? 'waiting'
      : 'not-run';

const finished = (ended: CellEnding): boolean =>
  ended === 'done' || ended === 'held' || ended === 'failed';

/**
 * The pipeline brought up to date: where the live copy knows a run newer than the ledgers' latest, its cell
 * says what that run says. For the same run the ledger wins once it has an ending, because it is the record
 * and the live copy may have missed the run's last report. Either way the cell counts every run either side
 * knows. A thought the deploy has not seen yet gets a row under its folder name.
 */
export function withLive(
  rows: readonly PipelineRow[],
  live: readonly LiveCell[],
  agents: readonly PipelineAgent[],
): PipelineRow[] {
  const known = new Set(rows.map((r) => r.slug));
  const added = [...new Set(live.map((l) => l.thought))]
    .filter((slug) => !known.has(slug))
    .map((slug) => ({ slug, title: slug, cells: agents.map(() => null) }));
  return [...rows, ...added]
    .sort((a, b) => b.slug.localeCompare(a.slug))
    .map((row) => ({
      ...row,
      cells: row.cells.map((cell, i) => {
        const now = live.find((l) => l.thought === row.slug && l.agent === agents[i]?.name);
        if (!now) return cell;
        const runs = Math.max(now.runs, cell?.runs ?? 0);
        // Run ids begin with when the run started, so the later id is the later run.
        if (cell !== null && (now.id < cell.id || (now.id === cell.id && finished(cell.ended))))
          return { ...cell, runs };
        return {
          id: now.id,
          ended: endingOfState(now.state),
          on: now.startedAt.slice(0, 10),
          runs,
        };
      }),
    }));
}
