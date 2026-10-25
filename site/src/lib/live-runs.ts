// Why: the studio sees an agent's run while it happens because the runner sends each ledger event here as it
// records it. The ledger file in git stays the record; what is stored from these events is a live copy, so it
// must never hold something the ledger would not: every event is checked against the chain before it is
// kept (its position, the hash before it, and its own hash recomputed the way the ledger computes it). A
// resend of events already kept is accepted and changes nothing, so a runner may retry freely; a gap or a
// changed event is refused with what to send instead. Pure apart from hashing, so the rules are tested here.
import { hashOf, type LedgerEvent } from '@roadbook/core';
import { isThoughtSlug } from './comments';

export const GENESIS = '0'.repeat(64);
/** More than any run writes in one go; a runner sends a few at a time. */
export const MAX_EVENTS = 200;

const RUN_ID = /^\d{8}T\d{6}Z-[a-z][a-z-]*-[0-9a-f]{4}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** A run's id as the runner makes it: its start time, the agent, four random hex digits. */
export function isRunId(value: unknown): value is string {
  return typeof value === 'string' && RUN_ID.test(value);
}

/** The agent in a run id: 20261025T071128Z-safety-d367 is the safety agent's. */
export function agentOfRun(id: string): string {
  return id.slice('20261025T071128Z-'.length, -'-d367'.length);
}

export interface AppendRequest {
  thought: string;
  events: LedgerEvent[];
}

function isEvent(value: unknown): value is LedgerEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.type === 'string' &&
    typeof e.seq === 'number' &&
    Number.isInteger(e.seq) &&
    e.seq >= 0 &&
    typeof e.at === 'string' &&
    typeof e.prev === 'string' &&
    HEX64.test(e.prev) &&
    typeof e.hash === 'string' &&
    HEX64.test(e.hash)
  );
}

export function readAppendRequest(
  body: unknown,
): { ok: true; value: AppendRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Send JSON.' };
  const { thought, events } = body as { thought?: unknown; events?: unknown };
  if (!isThoughtSlug(thought)) return { ok: false, error: 'Name the thought the run is on.' };
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS)
    return { ok: false, error: `Send between 1 and ${String(MAX_EVENTS)} events.` };
  if (!events.every(isEvent)) return { ok: false, error: 'Something sent is not a ledger event.' };
  return { ok: true, value: { thought, events } };
}

/** What is already kept for a run: how many events, and the hash of the last. */
export interface Kept {
  count: number;
  hash: string;
}

export type Checked =
  { ok: true; fresh: LedgerEvent[]; head: Kept } | { ok: false; status: 409 | 422; error: string };

/**
 * Which of the sent events are new, after checking each against the chain. `known` holds the hashes already
 * kept for any sent position below `kept.count`, so a resend can be told from a change.
 */
export async function checkAppend(
  kept: Kept,
  known: ReadonlyMap<number, string>,
  events: readonly LedgerEvent[],
): Promise<Checked> {
  const fresh: LedgerEvent[] = [];
  let next = kept.count;
  let last = kept.count === 0 ? GENESIS : kept.hash;
  for (const event of events) {
    const { hash, ...head } = event;
    // Every event sent must be what its own hash says, a resend included: a forged copy is refused, not
    // waved through because its place is already filled.
    if ((await hashOf(head)) !== hash)
      return {
        ok: false,
        status: 422,
        error: `Event ${String(event.seq)} is not what its hash says. It was not kept.`,
      };
    if (event.seq < kept.count) {
      if (known.get(event.seq) !== event.hash)
        return {
          ok: false,
          status: 409,
          error: `Event ${String(event.seq)} differs from the one already kept. A ledger is never rewritten.`,
        };
      continue;
    }
    if (event.seq !== next)
      return {
        ok: false,
        status: 409,
        error: `Events from ${String(next)} are missing. Send from event ${String(next)}.`,
      };
    if (event.prev !== last)
      return {
        ok: false,
        status: 422,
        error: `Event ${String(event.seq)} does not follow the chain. It was not kept.`,
      };
    fresh.push(event);
    last = hash;
    next += 1;
  }
  return { ok: true, fresh, head: { count: next, hash: last } };
}

/** One run as the studio lists it, kept up to date as its events arrive. */
export interface LiveRunRow {
  id: string;
  thought: string;
  agent: string;
  /** The state its node last moved to: running, needs-you, done, held or failed. */
  state: string;
  startedAt: string;
  updatedAt: string;
  usd: number;
  events: number;
  head: string;
}

/** The run's row after its new events: the latest state, the cost so far, how far the chain reaches. */
export function summarise(
  current: LiveRunRow | null,
  id: string,
  thought: string,
  fresh: readonly LedgerEvent[],
  head: Kept,
): LiveRunRow {
  let state = current?.state ?? 'running';
  let usd = current?.usd ?? 0;
  for (const event of fresh) {
    if (event.type === 'node.state') state = event.to;
    if (event.type === 'cost.incurred') usd += event.usd;
  }
  return {
    id,
    thought,
    agent: agentOfRun(id),
    state,
    startedAt: current?.startedAt ?? fresh[0]?.at ?? new Date().toISOString(),
    updatedAt: fresh.at(-1)?.at ?? current?.updatedAt ?? new Date().toISOString(),
    usd: Math.round(usd * 1_000_000) / 1_000_000,
    events: head.count,
    head: head.hash,
  };
}
