// Why: the ledger is the roadbook. Every run is an ordered list of events that is only ever appended to,
// each one chained to the one before by a hash, so nothing can be changed or removed later without the
// chain showing it. Replays, receipts, costs and the disclosure on a published item are all read from
// here and nowhere else, so what a reader is told is exactly what happened.
//
// It uses Web Crypto so the same code runs in Node, in a Cloudflare Worker and in the browser.

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

/** The rules an event must meet before it is written; the accountability rules, at the moment of writing. */
function refuse(body: EventBody): string | null {
  switch (body.type) {
    case 'node.output':
      if (body.why.trim().length < 20) return `the output of "${body.node}" has no proper why`;
      if (body.receipt.agent !== body.node && body.authoredBy === 'agent')
        return `the receipt for "${body.node}" names a different agent`;
      return null;
    case 'override.given':
      if (body.reason.trim().length < 5) return `overriding "${body.node}" needs a reason`;
      return null;
    case 'correction':
      if (body.reason.trim().length < 5) return 'a correction needs a reason';
      return null;
    default:
      return null;
  }
}

export class Ledger {
  readonly #events: LedgerEvent[] = [];
  readonly #now: () => Date;
  /** Appends run one after another, so two at once never read the same position or previous hash. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(options: { now?: () => Date } = {}) {
    this.#now = options.now ?? (() => new Date());
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
    return structuredClone(event);
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
