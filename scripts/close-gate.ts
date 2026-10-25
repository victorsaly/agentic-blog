// Why: a gate closes only in git, so the record stays where every other record is. The studio sends
// close-gate with the decision and who made it; the gates workflow runs this on the gate's branch. It checks
// the gate is still open and the decision fits (closeGate in @roadbook/core), writes an answer as an origin
// file when there is one, and carries the gate's run on: the words, who closed it, and done. The run is
// reported live as it goes, so the studio shows the gate closed. An answer file that is already there is
// never overwritten: origin is append-only. The tools run from main; CONTENT_ROOT names the checkout of the
// gate's branch that is changed (the repository itself when unset). It also names what starts next (the
// "start" output, which the workflow starts on the same branch): the steps after the gate, or, when Victor
// sent it back, the steps before it, which then run again with his words.
// When the gate approved is the one before the way out, it says so ("merge"), and the workflow merges the
// pull request once its checks pass: the approval in the studio is the merge. Such an approval is refused when
// something before the gate changed since it opened, and one already recorded is not recorded again, only
// merged (running the workflow again resumes a merge that did not go through).
//   PAYLOAD='{"run":…,"thought":…,"decision":…,"words":…,"by":…}' npx tsx scripts/close-gate.ts
import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  Ledger,
  closeGate,
  isPerson,
  leadsOut,
  stepsBefore,
  stepsToStart,
  stillReady,
} from '@roadbook/core';
import project from '../roadbook.config';
import { extendRun, readRuns } from '@roadbook/core/node';
import { liveFromEnv } from '../agents/_lib/live';
import {
  answerFileFor,
  answerOrigin,
  closeGatePayload,
  nextNumber,
  numberOf,
  numbersFromGrep,
  publishedStructure,
} from './gate-answer';
import { claimNumber, claimsIn } from './claim-number';

const git = promisify(execFile);
const root = resolve(process.env['CONTENT_ROOT'] ?? resolve(import.meta.dirname, '..'));
const payload = closeGatePayload.parse(JSON.parse(process.env['PAYLOAD'] ?? 'null'));
const thoughtDir = join(root, 'thoughts', payload.thought);

const { runs, issues } = await readRuns(thoughtDir, `thoughts/${payload.thought}`);
if (issues.length > 0) throw new Error(issues.join('\n'));
const run = runs.find((r) => r.id === payload.run);
if (!run) throw new Error(`No run ${payload.run} on ${payload.thought} on this branch.`);

const workflow = project.workflows.find((w) => w.id === 'blog-post');
const opened = run.events.find((e) => e.type === 'gate.opened');
const gate = opened?.type === 'gate.opened' ? opened.node : '';
const merging =
  payload.decision === 'approved' && workflow !== undefined && leadsOut(workflow, gate);
const out = process.env['GITHUB_OUTPUT'];
const write = async (outputs: Record<string, string>): Promise<void> => {
  if (out)
    for (const [key, value] of Object.entries(outputs))
      await appendFile(out, `${key}<<EOF_GATE\n${value}\nEOF_GATE\n`);
};

// A merge that did not go through (a check failed, GitHub was busy) is tried again by running the workflow
// again: the approval is already in the ledger, by a person, so it is not recorded twice, and only the merge
// is carried out.
if (
  merging &&
  run.events.some((e) => e.type === 'gate.closed' && e.decision === 'approved' && isPerson(e.by))
) {
  await write({ title: '', body: '', branch: '', start: '', gate, merge: 'true' });
  console.info(JSON.stringify({ resumed: gate, decision: payload.decision }));
  process.exit(0);
}

// Approving the gate before the way out agrees to what is there now; if a step before it held or ran again
// since it opened, the approval would be for something else, so nothing is recorded.
if (merging && !stillReady(workflow, gate, runs))
  throw new Error(
    `Not approved: something before the ${gate} gate changed since it opened (a guard held, or a step ran again). Nothing was recorded; approve it again when the route is done.`,
  );

const closing = closeGate(run.events, payload);
if (!closing.ok) throw new Error(closing.error);

const date = new Date().toISOString().slice(0, 10);
const file = answerFileFor(closing.node, payload.decision);
if (file !== null) {
  const path = join(thoughtDir, file);
  const there = await stat(path).then(
    () => true,
    () => false,
  );
  if (there)
    throw new Error(
      `thoughts/${payload.thought}/${file} is already there; an origin is never overwritten.`,
    );
  await mkdir(dirname(path), { recursive: true });
  const spoken = payload.medium === 'voice' && payload.key ? { key: payload.key } : undefined;
  await writeFile(path, answerOrigin(payload.thought, payload.words, date, payload.by, spoken), {
    encoding: 'utf8',
    flag: 'wx',
  });
}

// Approving the gate before the way out publishes the thought: the commit that records the approval, the one
// the workflow merges, also carries it out of draft with the next free number. The numbers are read on main, on the gate's branch, and on every
// other branch fetched into it: a thought approved but not merged yet holds its number, so a second approval
// before the first merge takes the next one, and a branch made before another thought went out never takes
// that one's. Two approvals at the same moment cannot both win either: the number is claimed by pushing the
// tag number/N to NUMBER_REMOTE (the gates workflow sets it), a push git refuses when the tag is there, and
// the one refused takes the next. A thought that already claimed one, in a run that failed later, keeps it.
let number: number | null = null;
if (merging) {
  const path = join(thoughtDir, 'structure.md');
  const source = await readFile(path, 'utf8');
  // Only a draft is given a number; one already out keeps its own and claims nothing.
  if (publishedStructure(source, 1) !== null) {
    const main = resolve(import.meta.dirname, '..');
    const claims = await claimsIn(root);
    const taken = [
      ...(await Promise.all([numbersIn(root), numbersIn(main), numbersOnBranches(root)])).flat(),
      ...claims.filter((c) => c.thought !== payload.thought).map((c) => c.number),
    ];
    const remote = process.env['NUMBER_REMOTE'];
    const given =
      numberOf(source) ??
      claims.find((c) => c.thought === payload.thought)?.number ??
      (remote ? await claimNumber(root, remote, payload.thought, taken) : nextNumber(taken));
    const published = publishedStructure(source, given);
    if (published !== null) {
      await writeFile(path, published, 'utf8');
      number = numberOf(published);
    }
  }
}

// Carry the run on from where it was saved, telling the studio every event (a resend changes nothing there).
const live = liveFromEnv(run.id, payload.thought, process.env);
const last = run.events.at(-1);
const ledger = await Ledger.resume(
  run.events,
  { count: run.events.length, hash: last?.hash ?? '0'.repeat(64) },
  { onAppend: live.hear },
);
for (const event of run.events) live.hear(event);
for (const body of closing.bodies) await ledger.append(body);
await extendRun(thoughtDir, run.id, ledger);
await live.flush();

// What starts next, from the workflow and the runs as they now stand, this gate closed.
const now = runs.map((r) => (r.id === run.id ? { id: r.id, events: ledger.events } : r));
const start = !workflow
  ? []
  : payload.decision === 'redirected'
    ? stepsBefore(workflow, closing.node)
    : stepsToStart(workflow, closing.node, now);

const title = `content: ${closing.node} gate closed on ${payload.thought} (${payload.decision})`;
const outputs = {
  title,
  body: `Closed in the studio by ${payload.by}: \`${closing.node}\` ${payload.decision}.${file ? `\n\n- Answer: \`thoughts/${payload.thought}/${file}\`` : ''}${number !== null ? `\n\n- Published as thought ${String(number)}: it goes live with this merge.` : ''}\n- Run: \`${run.id}\``,
  branch: `gate/${payload.thought}-${run.id.slice(-4)}`,
  start: start.join(' '),
  // Approving the gate before the way out is Victor's merge; the workflow carries it out once checks pass.
  gate: closing.node,
  merge: merging ? 'true' : '',
};
await write(outputs);
console.info(
  JSON.stringify({ closed: closing.node, decision: payload.decision, file, number, start }),
);

/** The numbers every other thought under this checkout already has. */
async function numbersIn(checkout: string): Promise<number[]> {
  const dir = join(checkout, 'thoughts');
  const slugs = await readdir(dir).catch(() => []);
  const found = await Promise.all(
    slugs
      .filter((slug) => slug !== payload.thought)
      .map(async (slug) => {
        const source = await readFile(join(dir, slug, 'structure.md'), 'utf8').catch(() => '');
        const given = numberOf(source);
        return given === null ? [] : [given];
      }),
  );
  return found.flat();
}

/**
 * The numbers on every branch fetched into this checkout (the gates workflow fetches them all), in one grep.
 * None when nothing was fetched or nothing matched; a line in a body that looks like a number only leaves a gap.
 * The branches are named by their commits, so a name git cannot resolve never hides the rest; any other git
 * failure stops the gate, since guessing "no numbers" could give one twice.
 */
async function numbersOnBranches(checkout: string): Promise<number[]> {
  const opts = { cwd: checkout, maxBuffer: 16 * 1024 * 1024 };
  const listed = await git('git', ['for-each-ref', '--format=%(objectname)', 'refs/remotes'], opts);
  const commits = [...new Set(listed.stdout.split('\n').filter((sha) => sha !== ''))];
  if (commits.length === 0) return [];
  const grep = [
    'grep',
    '-E',
    '^number:[[:space:]]*[0-9]+',
    ...commits,
    '--',
    'thoughts/*/structure.md',
  ];
  const output = await git('git', grep, opts).then(
    (r) => r.stdout,
    (error: unknown) => {
      // git grep exits 1 when nothing matches; that is no numbers, not a failure.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 1)
        return '';
      throw error;
    },
  );
  return numbersFromGrep(output, payload.thought);
}
