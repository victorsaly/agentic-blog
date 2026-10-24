// Why: each thought keeps its own ledger beside its files, so the record of how a post was made travels with
// the post and shows in the same pull request. The events live in ledger.jsonl, only ever appended to; the
// head (how many events and the last hash) lives apart in ledger.head, so cutting events off the end shows.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Ledger, LedgerError, eventLines, readEvents, readHead } from '@roadbook/core';

export const LEDGER_FILE = 'ledger.jsonl';
export const HEAD_FILE = 'ledger.head';

export interface OpenLedger {
  ledger: Ledger;
  /** How many events were on disk when it was opened; only the ones after are appended. */
  kept: number;
}

async function readIfThere(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** The thought's ledger, verified, ready to carry on; a new one when the thought has none yet. */
export async function openLedger(dir: string, now?: () => Date): Promise<OpenLedger> {
  const [events, head] = await Promise.all([
    readIfThere(join(dir, LEDGER_FILE)),
    readIfThere(join(dir, HEAD_FILE)),
  ]);
  const options = now ? { now } : {};
  if (events === null && head === null) return { ledger: new Ledger(options), kept: 0 };
  if (events === null || head === null)
    throw new LedgerError(
      `${dir}: ${events === null ? LEDGER_FILE : HEAD_FILE} is missing; the two are kept together`,
    );
  const past = readEvents(events);
  return { ledger: await Ledger.resume(past, readHead(head), options), kept: past.length };
}

/** Appends the new events to ledger.jsonl and writes the head that now matches it. */
export async function saveLedger(dir: string, open: OpenLedger): Promise<void> {
  const events = open.ledger.events;
  const fresh = events.slice(open.kept);
  if (fresh.length === 0) return;
  await appendFile(join(dir, LEDGER_FILE), eventLines(fresh), 'utf8');
  await writeFile(join(dir, HEAD_FILE), `${JSON.stringify(open.ledger.head)}\n`, 'utf8');
}
