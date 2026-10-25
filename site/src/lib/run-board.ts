// Why: the Agents board and the run page read the runner's live copy, and what they say must be no more and
// no less than the ledger says. This reads the endpoints' answers back (nothing from the network is trusted
// unread), sorts runs into what Victor needs to know first, and puts each event in plain words. A run that
// says it is going but has gone quiet is marked quiet, not shown as working: the runner can be stopped
// without a last word. Pure, and free of the ledger's own code, so it runs in the browser and is tested here.
import type { LiveRunRow } from './live-runs';
import { agentName } from './agent-runs';
import { moneyOf, type Currency } from './money';

/** A run that has sent nothing for this long, while saying it is going, may have stopped without a word. */
export const QUIET_MS = 10 * 60_000;
/** How many finished runs the board lists. */
export const RECENT = 10;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Still going: the run's last word was that it is working, or waiting to. */
export function isGoing(state: string): boolean {
  return state === 'running' || state === 'waiting' || state === 'idle' || state === 'needs-you';
}

function isRow(value: unknown): value is LiveRunRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.thought === 'string' &&
    typeof value.agent === 'string' &&
    typeof value.state === 'string' &&
    typeof value.startedAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.usd === 'number' &&
    typeof value.events === 'number' &&
    typeof value.head === 'string'
  );
}

/** GET /api/runs read back; null when the answer is not a list of runs. */
export function readRunRows(data: unknown): LiveRunRow[] | null {
  if (!isRecord(data) || !Array.isArray(data.runs)) return null;
  return data.runs.filter(isRow);
}

/** One ledger event as the page shows it: its place, its time, its type, and the rest as sent. */
export interface ShownEvent {
  seq: number;
  at: string;
  type: string;
  fields: Record<string, unknown>;
}

function eventOf(value: unknown): ShownEvent | null {
  if (!isRecord(value)) return null;
  const { seq, at, type } = value;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || typeof at !== 'string') return null;
  if (typeof type !== 'string') return null;
  return { seq, at, type, fields: value };
}

export interface RunDetail {
  run: LiveRunRow;
  events: ShownEvent[];
  /** True when the run has more events after these; ask again from the last one. */
  more: boolean;
}

/** GET /api/runs/:id read back; null when it is not a run. An event that cannot be read is not shown. */
export function readRunDetail(data: unknown): RunDetail | null {
  if (!isRecord(data) || !isRow(data.run) || !Array.isArray(data.events)) return null;
  const events = data.events.map(eventOf).filter((e): e is ShownEvent => e !== null);
  return { run: data.run, events, more: data.more === true };
}

/** A run on the board, marked quiet when it says it is going but has sent nothing for a while. */
export interface BoardRun extends LiveRunRow {
  quiet: boolean;
}

export interface Board {
  needsYou: BoardRun[];
  going: BoardRun[];
  held: BoardRun[];
  finished: BoardRun[];
}

/** The runs sorted into what Victor needs to know first: newest first within each. */
export function boardOf(rows: readonly LiveRunRow[], now: string): Board {
  const sorted = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const marked = sorted.map((r) => ({
    ...r,
    quiet:
      r.state !== 'needs-you' &&
      isGoing(r.state) &&
      Date.parse(now) - Date.parse(r.updatedAt) > QUIET_MS,
  }));
  // A hold stands until the same agent runs on the same thought again; an older hold is history.
  const latest = new Set<string>();
  const standing = marked.filter((r) => {
    const key = `${r.thought} ${r.agent}`;
    if (latest.has(key)) return false;
    latest.add(key);
    return true;
  });
  return {
    needsYou: marked.filter((r) => r.state === 'needs-you'),
    going: marked.filter((r) => isGoing(r.state) && r.state !== 'needs-you'),
    held: standing.filter((r) => r.state === 'held'),
    finished: marked.filter((r) => r.state === 'done' || r.state === 'failed').slice(0, RECENT),
  };
}

/** A run's state as a word, the same words the GitHub list uses. */
export const stateWords: Record<string, string> = {
  idle: 'Starting',
  waiting: 'Waiting',
  running: 'Running',
  'needs-you': 'Needs you',
  done: 'Done',
  held: 'Held',
  failed: 'Did not finish',
};

export const stateWord = (state: string): string => stateWords[state] ?? state;

/** "0:42", "12:05", "1:02:05": a running clock, from one moment to another. */
export function clockOf(fromIso: string, toIso: string): string {
  const total = Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

/** One line of a run's timeline. Streamed text from one agent, sent in pieces, is one line. */
export interface TimelineLine {
  seq: number;
  at: string;
  /** Who did it: an agent's name, or the person the ledger names. */
  who: string | null;
  what: string;
  /** The words that came with it: a reason, a question, what was written and why. */
  detail: string | null;
  link: string | null;
  /** Streamed text, shown as it was written. */
  text: boolean;
}

const str = (fields: Record<string, unknown>, key: string): string | null => {
  const value = fields[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const agent = (fields: Record<string, unknown>): string | null => {
  const node = str(fields, 'node');
  return node === null ? null : agentName(node);
};

/** "local" and "owner" are how the runner names Victor; anyone else is named as the ledger names them. */
const person = (by: string | null): string | null =>
  by === null ? null : by === 'local' || by === 'owner' ? 'Victor' : by;

const stateMoves: Record<string, string> = {
  idle: 'is idle',
  waiting: 'is waiting',
  running: 'started',
  'needs-you': 'needs you',
  done: 'finished',
  held: 'held the post',
  failed: 'did not finish',
};

const decisions: Record<string, string> = {
  approved: 'approved',
  answered: 'answered',
  picked: 'picked one',
  redirected: 'sent it another way',
};

function lineOf(e: ShownEvent, currency: Currency): TimelineLine {
  const f = e.fields;
  const base = { seq: e.seq, at: e.at, who: agent(f), detail: null, link: null, text: false };
  switch (e.type) {
    case 'run.started':
      return {
        ...base,
        who: person(str(f, 'by')),
        what: `started the run (${str(f, 'workflow') ?? 'a workflow'})`,
        detail: str(f, 'origin'),
      };
    case 'node.state': {
      const to = str(f, 'to') ?? '';
      return { ...base, what: stateMoves[to] ?? `moved to ${to}`, detail: str(f, 'reason') };
    }
    case 'node.output': {
      const receipt = isRecord(f.receipt) ? f.receipt : {};
      const model = str(receipt, 'model');
      const ref = str(f, 'ref') ?? 'something';
      return {
        ...base,
        who: f.authoredBy === 'person' ? 'A person' : base.who,
        what: model === null ? `wrote ${ref}` : `wrote ${ref} (${model})`,
        detail: str(f, 'why'),
      };
    }
    case 'cost.incurred':
      return {
        ...base,
        what: `spent ${typeof f.usd === 'number' ? moneyOf(f.usd, currency) : 'an unknown amount'} on ${str(f, 'provider') ?? 'a provider'}`,
        detail: str(f, 'units'),
      };
    case 'gate.opened':
      return {
        ...base,
        what: `asks you to ${str(f, 'asks') ?? 'answer'}`,
        detail: str(f, 'question'),
      };
    case 'gate.closed': {
      const decision = str(f, 'decision') ?? '';
      return { ...base, who: person(str(f, 'by')), what: decisions[decision] ?? decision };
    }
    case 'feedback.given':
      return {
        ...base,
        who: person(str(f, 'by')),
        what: `talked back (${str(f, 'kind') ?? 'feedback'}) to ${base.who ?? 'the run'}`,
        detail: str(f, 'words'),
      };
    case 'hold.raised': {
      const quote = str(f, 'quote');
      const reason = str(f, 'reason');
      return {
        ...base,
        what: 'raised a hold',
        detail: quote === null ? reason : `${reason ?? ''} “${quote}”`.trim(),
      };
    }
    case 'override.given':
      return {
        ...base,
        who: person(str(f, 'by')),
        what: `overrode ${base.who ?? 'a step'}`,
        detail: str(f, 'reason'),
      };
    case 'run.published':
      return {
        ...base,
        what: `published to ${str(f, 'sink') ?? 'the site'}`,
        link: str(f, 'link'),
      };
    case 'correction':
      return {
        ...base,
        who: person(str(f, 'by')),
        what: `corrected event ${typeof f.of === 'number' ? String(f.of) : '?'}`,
        detail: str(f, 'reason'),
      };
    case 'node.delta':
      return {
        ...base,
        what: 'wrote',
        detail: typeof f.text === 'string' ? f.text : '',
        text: true,
      };
    default:
      return { ...base, what: e.type };
  }
}

/** A run's events as lines to read, in order; text streamed in pieces by one agent joins into one line. */
export function timelineOf(events: readonly ShownEvent[], currency: Currency): TimelineLine[] {
  const lines: TimelineLine[] = [];
  for (const event of events) {
    const line = lineOf(event, currency);
    const last = lines.at(-1);
    if (line.text && last?.text === true && last.who === line.who) {
      lines[lines.length - 1] = { ...last, detail: `${last.detail ?? ''}${line.detail ?? ''}` };
      continue;
    }
    lines.push(line);
  }
  return lines;
}
