// Why: the board and GitHub's own list on the Agents page both need what GitHub is running, and two islands
// asking GitHub the same question would double the asking and could disagree for a moment, which is how the
// top of the page said nothing was running while the list under it showed a run. This is the one asker on a
// page, like the live runs feed: it starts with the first island that listens and stops with the last, and
// keeps what it last heard when an ask fails, so a failure never reads as all quiet.
import { useSyncExternalStore } from 'react';
import { readLiveRuns, type LiveRun } from '../lib/agent-runs';
import { poll } from './use-poll';

const BUSY_MS = 15_000;
const QUIET_MS = 60_000;

export interface GithubFeed {
  /** What GitHub last said, and when; null until it first answers. */
  known: { runs: LiveRun[]; at: string } | null;
  error: string | null;
}

let feed: GithubFeed = { known: null, error: null };
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function set(next: GithubFeed): void {
  feed = next;
  for (const listener of listeners) listener();
}

function errorOf(data: unknown): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : 'The studio could not read the agent runs.';
}

async function ask(): Promise<number> {
  try {
    const response = await fetch('/api/agents');
    const data: unknown = await response.json().catch(() => null);
    const runs = response.ok ? readLiveRuns(data) : null;
    if (runs === null) throw new Error(errorOf(data));
    set({ known: { runs, at: new Date().toISOString() }, error: null });
    return runs.some((r) => r.state === 'running' || r.state === 'queued') ? BUSY_MS : QUIET_MS;
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'The studio could not be reached. Check the connection.';
    set({ known: feed.known, error: message });
    return QUIET_MS;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  stop ??= poll(ask);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = null;
    }
  };
}

const empty: GithubFeed = { known: null, error: null };

/** What GitHub is running, shared by every island on the page. */
export function useGithubFeed(): GithubFeed {
  return useSyncExternalStore(
    subscribe,
    () => feed,
    () => empty,
  );
}
