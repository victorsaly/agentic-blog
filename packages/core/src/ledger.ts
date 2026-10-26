// Why: the ledger is the roadbook. Every run is an ordered list of events that is only ever appended to,
// each one chained to the one before by a hash, so nothing can be changed or removed later without the
// chain showing it. Replays, receipts, costs and the disclosure on a published item are all read from
// here and nowhere else, so what a reader is told is exactly what happened.
//
// It uses Web Crypto so the same code runs in Node, in a Cloudflare Worker and in the browser.
import { z } from 'zod';

export type NodeState = 'idle' | 'waiting' | 'running' | 'needs-you' | 'done' | 'held' | 'failed';

/** What every output carries, attached by the runtime, never written by the agent. */
export interface Receipt {
  origin: string;
  /** SHA-256 of the exact inputs the node was given. */
  inputsHash: string;
  agent: string;
  cardVersion: string;
  /** SHA-256 of the instructions the model actually received. */
  promptHash: string;
  provider: string;
  model: string;
  at: string;
  usd: number;
}

export type EventBody =
  | { type: 'run.started'; workflow: string; origin: string; by: string }
  | { type: 'node.state'; node: string; from: NodeState; to: NodeState; reason?: string }
  | { type: 'node.delta'; node: string; text: string }
  | {
      type: 'node.output';
      node: string;
      why: string;
      receipt: Receipt;
      /** Where the artifact is kept (a path in the repo, a key in storage); not the artifact itself. */
      ref: string;
      authoredBy: 'agent' | 'person';
    }
  | { type: 'gate.opened'; node: string; asks: 'answer' | 'approve' | 'pick'; question: string }
  | {
      type: 'gate.closed';
      node: string;
      decision: 'approved' | 'answered' | 'picked' | 'redirected';
      by: string;
    }
  | {
      type: 'feedback.given';
      node: string;
      kind: 'approve' | 'edit' | 'redirect' | 'regenerate' | 'pick';
      words: string;
      by: string;
    }
  | { type: 'hold.raised'; node: string; reason: string; quote?: string }
  | { type: 'override.given'; node: string; reason: string; by: string }
  | { type: 'cost.incurred'; node: string; provider: string; usd: number; units: string }
  | { type: 'run.published'; sink: string; link: string; replay: 'public' | 'private' }
  | { type: 'correction'; of: number; reason: string; by: string };

export type LedgerEvent = EventBody & {
  /** Position in the run, from 0. */
  seq: number;
  at: string;
  /** Hash of the previous event; the first event points at 64 zeros. */
  prev: string;
  hash: string;
};

export interface LedgerHead {
  count: number;
  hash: string;
}

const GENESIS = '0'.repeat(64);

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A stable JSON form, keys sorted, so the same content always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

export async function hashOf(value: unknown): Promise<string> {
  return sha256(canonical(value));
}

export class LedgerError extends Error {}

/**
 * A person, as a decision names them: the owner, or an email address (the studio records the signed-in one).
 * An agent's name, a workflow's, or nothing at all is not a person.
 */
export function isPerson(by: string): boolean {
  return by === 'owner' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(by);
}

/**
 * The rules an event must meet; the accountability rules, at the moment of writing and again on reading, so
 * an event made by hand with a good hash is refused all the same. Null when the event may stand.
 */
export function refuse(body: EventBody): string | null {
  switch (body.type) {
    case 'node.output':
      if (body.why.trim().length < 20) return `the output of "${body.node}" has no proper why`;
      if (body.receipt.agent !== body.node && body.authoredBy === 'agent')
        return `the receipt for "${body.node}" names a different agent`;
      return null;
    case 'override.given':
      if (body.reason.trim().length < 5) return `overriding "${body.node}" needs a reason`;
      if (!isPerson(body.by))
        return `RB080: only a person overrides "${body.node}", and "${body.by}" is not one. Fix: override from the studio, which records who is signed in`;
      return null;
    case 'gate.closed':
      if (!isPerson(body.by))
        return `RB080: the gate "${body.node}" is closed only by a person, and "${body.by}" is not one. Fix: close it from the studio, which records who is signed in`;
      return null;
    case 'correction':
      if (body.reason.trim().length < 5) return 'a correction needs a reason';
      return null;
    default:
      return null;
  }
}

/** Told about each event the moment it is recorded, with a copy it may keep. A listener that throws or
 * rejects never stops or undoes the recording: the ledger is the record, the listener only hears about it. */
export type AppendListener = (event: LedgerEvent) => void;

export class Ledger {
  readonly #events: LedgerEvent[] = [];
  readonly #now: () => Date;
  readonly #onAppend: AppendListener | undefined;
  /** Appends run one after another, so two at once never read the same position or previous hash. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(options: { now?: () => Date; onAppend?: AppendListener } = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#onAppend = options.onAppend;
  }

  /** A copy of the events: changing it cannot rewrite what was recorded. */
  get events(): readonly LedgerEvent[] {
    return structuredClone(this.#events);
  }

  /** How many events there are and the hash of the last; keep it apart from the events to detect a cut end. */
  get head(): LedgerHead {
    return { count: this.#events.length, hash: this.#events.at(-1)?.hash ?? GENESIS };
  }

  append(body: EventBody): Promise<LedgerEvent> {
    const next = this.#queue.then(() => this.#write(body));
    this.#queue = next.catch(() => undefined);
    return next;
  }

  async #write(input: EventBody): Promise<LedgerEvent> {
    // A copy, so the caller changing its object (a receipt, say) afterwards cannot change the record.
    const body = structuredClone(input);
    const reason = refuse(body);
    if (reason !== null) throw new LedgerError(`refused: ${reason}`);
    if (body.type === 'correction' && (body.of < 0 || body.of >= this.#events.length)) {
      throw new LedgerError(
        `refused: a correction must point at an earlier event (got ${String(body.of)})`,
      );
    }
    const last = this.#events.at(-1);
    const head = {
      ...body,
      seq: this.#events.length,
      at: this.#now().toISOString(),
      prev: last?.hash ?? GENESIS,
    };
    const event: LedgerEvent = { ...head, hash: await hashOf(head) };
    this.#events.push(event);
    try {
      this.#onAppend?.(structuredClone(event));
    } catch {
      // Hearing about an event is never a reason to lose it.
    }
    return structuredClone(event);
  }

  /**
   * Picks up a ledger kept on disk and carries on from its last event. Every event is checked against the
   * chain and the head kept apart from it first; a ledger that does not verify is refused, never extended,
   * because a new event chained to a changed past would make the change look legitimate.
   */
  static async resume(
    events: readonly LedgerEvent[],
    head: LedgerHead,
    options: { now?: () => Date; onAppend?: AppendListener } = {},
  ): Promise<Ledger> {
    const broken = await Ledger.verify(events, head);
    if (broken !== null)
      throw new LedgerError(`refused: the ledger does not verify from event ${String(broken)}`);
    const ledger = new Ledger(options);
    ledger.#events.push(...structuredClone(events));
    return ledger;
  }

  /**
   * Recomputes the chain. Returns the first broken position, or null when every event is intact. The chain
   * alone shows a change or a removal in the middle; a removed end leaves a valid shorter chain, so pass the
   * head kept from the run (`ledger.head`, stored apart from the events) to detect that too. The position
   * returned for a cut end is where the first missing event should have been.
   */
  static async verify(
    events: readonly LedgerEvent[],
    expected?: LedgerHead,
  ): Promise<number | null> {
    let prev = GENESIS;
    for (const [index, event] of events.entries()) {
      const { hash, ...head } = event;
      if (event.seq !== index || event.prev !== prev || (await hashOf(head)) !== hash) return index;
      prev = hash;
    }
    if (expected && (events.length !== expected.count || prev !== expected.hash)) {
      return Math.min(events.length, expected.count);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------------------------- on disk

// A ledger is kept as one JSON event per line (ledger.jsonl) and its head apart (ledger.head). Reading checks
// only the envelope of each line; verify() is what proves the content, by recomputing every hash.

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const envelope = z
  .object({
    type: z.string().min(1),
    seq: z.number().int().min(0),
    at: z.string(),
    prev: hex64,
    hash: hex64,
  })
  .loose();
const headShape = z.object({ count: z.number().int().min(0), hash: hex64 });

/** The events in a ledger.jsonl file, oldest first. Throws on a line that is not an event. */
export function readEvents(jsonl: string): LedgerEvent[] {
  return jsonl
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== '')
    .map(({ line, number }) => {
      let data: unknown;
      try {
        data = JSON.parse(line);
      } catch {
        throw new LedgerError(`line ${String(number)} is not JSON`);
      }
      const parsed = envelope.safeParse(data);
      if (!parsed.success) throw new LedgerError(`line ${String(number)} is not a ledger event`);
      // The envelope is checked here; the hash, checked by verify(), covers every other field.
      return parsed.data as unknown as LedgerEvent;
    });
}

/** The head in a ledger.head file. Throws when it is not a count and a hash. */
export function readHead(json: string): LedgerHead {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new LedgerError('the head is not JSON');
  }
  const parsed = headShape.safeParse(data);
  if (!parsed.success) throw new LedgerError('the head is not a count and a hash');
  return parsed.data;
}

/** Events as ledger.jsonl lines, each ending in a newline, so appending more lines keeps the file valid. */
export function eventLines(events: readonly LedgerEvent[]): string {
  return events.map((e) => `${JSON.stringify(e)}\n`).join('');
}

// ---------------------------------------------------------------------------------------------- readings

export interface Costs {
  totalUsd: number;
  byNode: Record<string, number>;
  byProvider: Record<string, number>;
}

export function costs(events: readonly LedgerEvent[]): Costs {
  const result: Costs = { totalUsd: 0, byNode: {}, byProvider: {} };
  for (const e of events) {
    if (e.type !== 'cost.incurred') continue;
    result.totalUsd += e.usd;
    result.byNode[e.node] = (result.byNode[e.node] ?? 0) + e.usd;
    result.byProvider[e.provider] = (result.byProvider[e.provider] ?? 0) + e.usd;
  }
  return result;
}

export interface Disclosure {
  /** Outputs an agent produced and nobody edited. */
  byAgent: string[];
  /** Outputs an agent produced that a person then edited. */
  editedByPerson: string[];
  /** Outputs a person wrote. */
  byPerson: string[];
  overrides: { node: string; reason: string; by: string }[];
}

/**
 * What the published item may say about how it was made, computed from the ledger. It cannot claim more
 * human work than the events show: an output counts as edited only if an edit was recorded after it.
 */
export function disclosure(events: readonly LedgerEvent[]): Disclosure {
  const authored = new Map<string, 'agent' | 'person'>();
  const edited = new Set<string>();
  const overrides: Disclosure['overrides'] = [];
  for (const e of events) {
    if (e.type === 'node.output') {
      // A new output replaces the one an edit was made to; the edit does not carry over to it.
      authored.set(e.node, e.authoredBy);
      edited.delete(e.node);
    }
    if (e.type === 'feedback.given' && e.kind === 'edit') edited.add(e.node);
    if (e.type === 'override.given') overrides.push({ node: e.node, reason: e.reason, by: e.by });
  }
  const byAgent: string[] = [];
  const editedByPerson: string[] = [];
  const byPerson: string[] = [];
  for (const [node, who] of authored) {
    if (who === 'person') byPerson.push(node);
    else if (edited.has(node)) editedByPerson.push(node);
    else byAgent.push(node);
  }
  return { byAgent, editedByPerson, byPerson, overrides };
}
