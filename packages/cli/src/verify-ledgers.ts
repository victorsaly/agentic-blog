// Why: a ledger is only proof if nobody can quietly change it. CI runs this on every pull request: each
// thought's ledger.jsonl must recompute to the head kept beside it, so editing, removing or reordering a past
// event, or cutting events off the end, fails the build and names the thought and the event.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Ledger, readEvents, readHead } from '@roadbook/core';

const LEDGER_FILE = 'ledger.jsonl';
const HEAD_FILE = 'ledger.head';

/** Checks one thought folder; returns what is wrong with its ledger, or nothing. */
export async function verifyLedgerFiles(
  where: string,
  events: string | null,
  head: string | null,
): Promise<string[]> {
  if (events === null && head === null) return [];
  if (events === null)
    return [`${where}: ${HEAD_FILE} has no ${LEDGER_FILE}. Fix: restore the ledger from git.`];
  if (head === null)
    return [`${where}: ${LEDGER_FILE} has no ${HEAD_FILE}. Fix: restore the head from git.`];
  try {
    const broken = await Ledger.verify(readEvents(events), readHead(head));
    return broken === null
      ? []
      : [
          `${where}: the ledger does not verify from event ${String(broken)}. A past event was changed, removed or cut off. Fix: restore ${LEDGER_FILE} and ${HEAD_FILE} from git; to correct an event, append a correction instead.`,
        ];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${where}: the ledger cannot be read (${message}).`];
  }
}

async function readIfThere(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/** Checks the ledger of every thought under <root>/thoughts. */
export async function verifyLedgers(root: string): Promise<{ checked: number; issues: string[] }> {
  const thoughts = join(root, 'thoughts');
  const folders = (await readdir(thoughts, { withFileTypes: true })).filter((d) => d.isDirectory());
  const issues: string[] = [];
  let checked = 0;
  for (const folder of folders) {
    const dir = join(thoughts, folder.name);
    const [events, head] = await Promise.all([
      readIfThere(join(dir, LEDGER_FILE)),
      readIfThere(join(dir, HEAD_FILE)),
    ]);
    if (events !== null || head !== null) checked += 1;
    issues.push(...(await verifyLedgerFiles(`thoughts/${folder.name}`, events, head)));
  }
  return { checked, issues: issues.sort() };
}
