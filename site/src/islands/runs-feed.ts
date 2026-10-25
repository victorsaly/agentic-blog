// Why: the board, the pipeline and Today's list all read the same live runs, and three islands asking the
// same question every few seconds would triple the asking and could disagree for a moment. This is the one
// asker on a page: it starts with the first island that listens and stops with the last. It keeps what it
// last heard when an ask fails, so a failure never reads as all quiet, and it tells the tab row how many
// agents wait on Victor each time it hears.
import { useSyncExternalStore } from 'react';
import { isGoing, readRunsAnswer, waitingOnVictor, type RunsAnswer } from '../lib/run-board';
import { AGENTS_WAITING } from '../lib/studio-areas';
import { poll } from './use-poll';

const BUSY_MS = 5_000;
const QUIET_MS = 30_000;

export interface RunsFeed {
  /** What the studio last said, and when; null until it first answers. */
  known: (RunsAnswer & { at: string }) | null;
  error: string | null;
}

let feed: RunsFeed = { known: null, error: null };
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function set(next: RunsFeed): void {
  feed = next;
  for (const listener of listeners) listener();
}

function errorOf(data: unknown): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : 'The studio could not read the runs.';
}

async function ask(): Promise<number> {
  try {
    const response = await fetch('/api/runs');
    const data: unknown = await response.json().catch(() => null);
    const answer = response.ok ? readRunsAnswer(data) : null;
    if (answer === null) throw new Error(errorOf(data));
    set({ known: { ...answer, at: new Date().toISOString() }, error: null });
    const { holds, asking } = waitingOnVictor(answer);
    window.dispatchEvent(new CustomEvent(AGENTS_WAITING, { detail: holds.length + asking.length }));
    // A run waiting on Victor can wait for days; only work in progress is worth asking about often.
    const working = answer.runs.some((r) => isGoing(r.state) && r.state !== 'needs-you');
    return working ? BUSY_MS : QUIET_MS;
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

const empty: RunsFeed = { known: null, error: null };

/** The live runs, shared by every island on the page. */
export function useRunsFeed(): RunsFeed {
  return useSyncExternalStore(
    subscribe,
    () => feed,
    () => empty,
  );
}
