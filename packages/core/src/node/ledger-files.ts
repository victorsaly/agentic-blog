// Why: a ledger on disk is read and written in one place, so the runner that writes it and the CI check that
// proves it can never disagree about what a ledger is. Each run keeps its own file, ledger/<run>.jsonl, with
// its head beside it in ledger/<run>.head: two branches that each run an agent on the same thought add two
// new files and merge cleanly, where one shared chain per thought could never be merged without breaking it.
// A merged run file is never changed or removed; CI checks that against the base branch.
//
// This is the Node side of the ledger; the rest of @roadbook/core stays free of the file system.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Ledger,
  LedgerError,
  eventLines,
  readEvents,
  readHead,
  refuse,
  type LedgerEvent,
} from '../ledger.js';

export const LEDGER_DIR = 'ledger';
const EVENTS = '.jsonl';
const HEAD = '.head';

export interface RunLedger {
  /** The run's file name without its extension; sorts oldest first. */
  id: string;
  events: LedgerEvent[];
}

/** A new run's id: when it started, to the second, which agent, and a few random characters. */
export function runId(at: Date, agent: string): string {
  const stamp = at
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return `${stamp}-${agent}-${randomBytes(2).toString('hex')}`;
}

/** True for a path inside a thought's ledger folder, written relative to the thought or to the repo. */
export function isLedgerPath(path: string): boolean {
  return /(^|\/)ledger\//.test(path.replace(/\\/g, '/'));
}

/** What is wrong with one run's two files, or nothing. Either half may be missing. */
export async function verifyRunText(
  where: string,
  events: string | null,
  head: string | null,
): Promise<string[]> {
  if (events === null)
    return [`${where}${HEAD} has no ${where}${EVENTS}. Fix: restore the run from git.`];
  if (head === null)
    return [`${where}${EVENTS} has no ${where}${HEAD}. Fix: restore the head from git.`];
  try {
    const read = readEvents(events);
    const broken = await Ledger.verify(read, readHead(head));
    if (broken === null) {
      // A good chain proves nothing was changed, not that what was written was allowed.
      return read.flatMap((event) => {
        const reason = refuse(event);
        return reason === null
          ? []
          : [`${where}: event ${String(event.seq)} is refused: ${reason}.`];
      });
    }
    return [
      `${where}: the run does not verify from event ${String(broken)}. A past event was changed, removed or cut off. Fix: restore ${where}${EVENTS} and ${where}${HEAD} from git; to correct an event, append a correction in a new run instead.`,
    ];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${where}: the run cannot be read (${message}).`];
  }
}

/**
 * Every run in a thought's ledger folder, oldest first, each checked against its head, with what is wrong.
 * A thought with no ledger folder has no runs. Any other failure to read is thrown, never taken as empty.
 */
export async function readRuns(
  thoughtDir: string,
  where = thoughtDir,
): Promise<{ runs: RunLedger[]; issues: string[] }> {
  const dir = join(thoughtDir, LEDGER_DIR);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { runs: [], issues: [] };
    throw error;
  }
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const name of names) {
    if (name.endsWith(EVENTS)) ids.add(name.slice(0, -EVENTS.length));
    else if (name.endsWith(HEAD)) ids.add(name.slice(0, -HEAD.length));
    else issues.push(`${where}/${LEDGER_DIR}/${name}: not part of a run. Fix: move it out.`);
  }
  const runs: RunLedger[] = [];
  for (const id of [...ids].sort()) {
    const has = (suffix: string): boolean => names.includes(`${id}${suffix}`);
    const [events, head] = await Promise.all([
      has(EVENTS) ? readFile(join(dir, `${id}${EVENTS}`), 'utf8') : null,
      has(HEAD) ? readFile(join(dir, `${id}${HEAD}`), 'utf8') : null,
    ]);
    const wrong = await verifyRunText(`${where}/${LEDGER_DIR}/${id}`, events, head);
    issues.push(...wrong);
    if (wrong.length === 0 && events !== null) runs.push({ id, events: readEvents(events) });
  }
  return { runs, issues };
}

/** Writes a finished run's events and head. A run file is written once; an existing one is never replaced. */
export async function saveRun(thoughtDir: string, id: string, ledger: Ledger): Promise<void> {
  const events = ledger.events;
  if (events.length === 0) return;
  const dir = join(thoughtDir, LEDGER_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}${EVENTS}`), eventLines(events), {
    encoding: 'utf8',
    flag: 'wx',
  });
  await writeFile(join(dir, `${id}${HEAD}`), `${JSON.stringify(ledger.head)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

/**
 * Writes a run that carries on from one already saved (a gate closed after it waited). The saved file must be
 * exactly the start of the new events, checked hash by hash; anything else is refused and nothing is written,
 * so extending can never rewrite what was there.
 */
export async function extendRun(thoughtDir: string, id: string, ledger: Ledger): Promise<void> {
  const dir = join(thoughtDir, LEDGER_DIR);
  const saved = readEvents(await readFile(join(dir, `${id}${EVENTS}`), 'utf8'));
  const events = ledger.events;
  const prefix = saved.length <= events.length && saved.every((e, i) => e.hash === events[i]?.hash);
  if (!prefix)
    throw new LedgerError(`refused: ${id} on disk is not the start of the run being saved`);
  await writeFile(join(dir, `${id}${EVENTS}`), eventLines(events), 'utf8');
  await writeFile(join(dir, `${id}${HEAD}`), `${JSON.stringify(ledger.head)}\n`, 'utf8');
}
