// Why: a ledger is only proof if nobody can quietly change it. CI runs this on every pull request: every run
// in each thought's ledger folder must recompute to the head kept beside it, so editing, removing or
// reordering a past event, or cutting events off the end, fails the build and names the run and the event.
// A file that cannot be read fails too; it is never taken for a thought with no ledger.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readRuns } from '@roadbook/core/node';

/** Checks the ledger of every thought under <root>/thoughts. */
export async function verifyLedgers(root: string): Promise<{ checked: number; issues: string[] }> {
  const thoughts = join(root, 'thoughts');
  const folders = (await readdir(thoughts, { withFileTypes: true })).filter((d) => d.isDirectory());
  const issues: string[] = [];
  let checked = 0;
  for (const folder of folders) {
    const where = `thoughts/${folder.name}`;
    try {
      const found = await readRuns(join(thoughts, folder.name), where);
      checked += found.runs.length;
      issues.push(...found.issues);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`${where}: the ledger cannot be read (${message}).`);
    }
  }
  return { checked, issues: issues.sort() };
}
