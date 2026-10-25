// Why: the studio's live copy of the runs (the runs and run_events tables) is only a copy; the ledger files in
// git are the record. This empties both tables and fills them again from every ledger, each run checked
// against its chain and head first, so a lost or muddled database costs nothing. It writes the SQL to a file
// and hands it to wrangler, against the local database unless --remote is given.
//   npm run live:rebuild            (local, for npm run worker:dev)
//   npm run live:rebuild -- --remote
import { execFileSync } from 'node:child_process';
import { readdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readRuns } from '@roadbook/core/node';
import { GENESIS, summarise } from '../site/src/lib/live-runs';

const root = resolve(import.meta.dirname, '..');
const quote = (value: string | number): string =>
  typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`;

const lines = ['DELETE FROM run_events;', 'DELETE FROM runs;'];
let count = 0;
for (const slug of (await readdir(join(root, 'thoughts'))).sort()) {
  const { runs, issues } = await readRuns(join(root, 'thoughts', slug), `thoughts/${slug}`);
  if (issues.length > 0) throw new Error(issues.join('\n'));
  for (const run of runs) {
    const last = run.events.at(-1);
    const row = summarise(null, run.id, slug, run.events, {
      count: run.events.length,
      hash: last?.hash ?? GENESIS,
    });
    for (const e of run.events)
      lines.push(
        `INSERT INTO run_events (run_id, seq, at, type, hash, event) VALUES (${[run.id, e.seq, e.at, e.type, e.hash, JSON.stringify(e)].map(quote).join(', ')});`,
      );
    lines.push(
      `INSERT INTO runs (id, thought, agent, state, started_at, updated_at, usd, events, head) VALUES (${[row.id, row.thought, row.agent, row.state, row.startedAt, row.updatedAt, row.usd, row.events, row.head].map(quote).join(', ')});`,
    );
    count += 1;
  }
}

const file = join(await mkdtemp(join(tmpdir(), 'live-runs-')), 'rebuild.sql');
await writeFile(file, `${lines.join('\n')}\n`, 'utf8');
const where = process.argv.includes('--remote') ? '--remote' : '--local';
execFileSync('npx', ['wrangler', 'd1', 'execute', 'COMMENTS_DB', where, `--file=${file}`], {
  cwd: join(root, 'site'),
  stdio: 'inherit',
});
console.info(`Rebuilt ${String(count)} runs from the ledgers (${where.slice(2)}).`);
