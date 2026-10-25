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
// pull request once its checks pass: the approval in the studio is the merge.
//   PAYLOAD='{"run":…,"thought":…,"decision":…,"words":…,"by":…}' npx tsx scripts/close-gate.ts
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Ledger, closeGate, leadsOut, stepsBefore, stepsToStart } from '@roadbook/core';
import project from '../roadbook.config';
import { extendRun, readRuns } from '@roadbook/core/node';
import { liveFromEnv } from '../agents/_lib/live';
import { answerFileFor, answerOrigin, closeGatePayload } from './gate-answer';

const root = resolve(process.env['CONTENT_ROOT'] ?? resolve(import.meta.dirname, '..'));
const payload = closeGatePayload.parse(JSON.parse(process.env['PAYLOAD'] ?? 'null'));
const thoughtDir = join(root, 'thoughts', payload.thought);

const { runs, issues } = await readRuns(thoughtDir, `thoughts/${payload.thought}`);
if (issues.length > 0) throw new Error(issues.join('\n'));
const run = runs.find((r) => r.id === payload.run);
if (!run) throw new Error(`No run ${payload.run} on ${payload.thought} on this branch.`);

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
const workflow = project.workflows.find((w) => w.id === 'blog-post');
const now = runs.map((r) => (r.id === run.id ? { id: r.id, events: ledger.events } : r));
const start = !workflow
  ? []
  : payload.decision === 'redirected'
    ? stepsBefore(workflow, closing.node)
    : stepsToStart(workflow, closing.node, now);

const title = `content: ${closing.node} gate closed on ${payload.thought} (${payload.decision})`;
const outputs = {
  title,
  body: `Closed in the studio by ${payload.by}: \`${closing.node}\` ${payload.decision}.${file ? `\n\n- Answer: \`thoughts/${payload.thought}/${file}\`` : ''}\n- Run: \`${run.id}\``,
  branch: `gate/${payload.thought}-${run.id.slice(-4)}`,
  start: start.join(' '),
  // Approving the gate before the way out is Victor's merge; the workflow carries it out once checks pass.
  gate: closing.node,
  merge:
    payload.decision === 'approved' && workflow && leadsOut(workflow, closing.node) ? 'true' : '',
};
const out = process.env['GITHUB_OUTPUT'];
if (out)
  for (const [key, value] of Object.entries(outputs))
    await appendFile(out, `${key}<<EOF_GATE\n${value}\nEOF_GATE\n`);
console.info(JSON.stringify({ closed: closing.node, decision: payload.decision, file, start }));
