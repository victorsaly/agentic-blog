// Why: a merged ledger run is the record and is never rewritten. One kind of change is not a rewrite: a run
// that was waiting on a person (a gate, in needs-you) carried on with his decision, its file the old one
// with new events after it, byte for byte. This guard, run in CI on every pull request, refuses every change
// to a merged run except that one, and every removal or rename. That the carried-on run still verifies
// against its head is checked by verify-ledgers, which CI runs first.
//   npx tsx scripts/ledger-guard.ts <base branch>
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

/** The last state a run's file records, from its JSON lines. */
function lastStateOf(jsonl: string): string | null {
  let state: string | null = null;
  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue;
    const event = JSON.parse(line) as { type?: unknown; to?: unknown };
    if (event.type === 'node.state' && typeof event.to === 'string') state = event.to;
  }
  return state;
}

/**
 * Why a change to a merged run's events is refused, or null when it is a waiting run carried on: the new
 * file starts with every byte of the old, adds to it, and the old one ended waiting on a person.
 */
export function refusalOf(before: string, after: string): string | null {
  if (!after.startsWith(before) || after.length === before.length)
    return 'A merged ledger run was changed.';
  if (lastStateOf(before) !== 'needs-you')
    return 'A merged ledger run that had finished was carried on; only a run waiting on a person may be.';
  return null;
}

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' });

async function main(base: string): Promise<void> {
  const ledger = 'thoughts/*/ledger/*';
  const errors: string[] = [];
  const gone = git('diff', '--name-only', '--diff-filter=DRT', 'FETCH_HEAD', 'HEAD', '--', ledger);
  for (const f of gone.split('\n').filter(Boolean))
    errors.push(`${f}: a merged ledger run was removed or renamed.`);
  const changed = git('diff', '--name-only', '--diff-filter=M', 'FETCH_HEAD', 'HEAD', '--', ledger)
    .split('\n')
    .filter(Boolean);
  for (const f of changed) {
    // A head moves with its events; it is checked through them (and verify-ledgers checks it matches).
    const events = f.endsWith('.head') ? f.replace(/\.head$/, '.jsonl') : f;
    if (f !== events && !changed.includes(events)) {
      errors.push(`${f}: a merged run's head changed while its events did not.`);
      continue;
    }
    if (f !== events) continue;
    const reason = refusalOf(git('show', `FETCH_HEAD:${f}`), await readFile(f, 'utf8'));
    if (reason) errors.push(`${f}: ${reason}`);
  }
  for (const e of errors) console.info(`::error file=${e.slice(0, e.indexOf(':'))}::${e}`);
  if (errors.length > 0) {
    console.info(
      `Fix: restore these from ${base}; to correct an event, record a correction in a new run.`,
    );
    process.exitCode = 1;
  } else console.info('No merged ledger run was rewritten.');
}

if (process.argv[1]?.endsWith('ledger-guard.ts')) await main(process.argv[2] ?? 'main');
