// Why: the studio's way to answer a gate. GET says what Victor needs beside the question: the pull request
// the gate is on and the file he is answering about (the interview's questions, the structure). POST takes
// his decision, checks that the run is a gate still waiting, that the decision fits what it asks, and that he
// is a person signed in through Access (RB080), and then only asks GitHub to run the gates workflow: the
// workflow writes, so git stays the record and its history shows who decided. At the gate before the way
// out, GET also lists the post's files still marked unreviewed, and an approval can carry the ones Victor
// ticked, so one press both merges and clears their "Not reviewed yet". Behind Cloudflare Access.
import { closeGate, isPerson, type LedgerEvent } from '@roadbook/core';
import { isRunId } from '../../../src/lib/live-runs';
import { bodyOf, gateContext, readGateRequest } from '../../../src/lib/gates';
import {
  isUnreviewed,
  reviewableIn,
  reviewableName,
  reviewableRank,
} from '../../../src/lib/review';
import { fileOn, githubHeaders, namesIn, pullHolding } from '../../_github';
import { json, problem, signedInEmail, type Env, type Handler } from '../../_lib';

interface GateRun {
  thought: string;
  events: LedgerEvent[];
}

/** The gate's run from the live copy: its thought and every event, as the runner sent them. */
async function gateRun(db: D1Database, id: string): Promise<GateRun | null> {
  const row = await db
    .prepare('SELECT thought FROM runs WHERE id = ?1')
    .bind(id)
    .first<{ thought: string }>();
  if (!row) return null;
  const { results } = await db
    .prepare('SELECT event FROM run_events WHERE run_id = ?1 ORDER BY seq')
    .bind(id)
    .all<{ event: string }>();
  return { thought: row.thought, events: results.map((r) => JSON.parse(r.event) as LedgerEvent) };
}

/** The post's versions, recordings and sources on the branch that still say `reviewed: false`. */
async function unreviewedOn(
  env: Env,
  thought: string,
  ref: string,
): Promise<{ file: string; name: string }[]> {
  const base = `thoughts/${thought}`;
  const [versions, voice] = await Promise.all([
    namesIn(env, `${base}/versions`, ref),
    namesIn(env, `${base}/voice`, ref),
  ]);
  const files = [
    ...versions.map((n) => `${base}/versions/${n}`),
    ...voice.map((n) => `${base}/voice/${n}`),
    `${base}/sources.md`,
  ].filter((f) => f.endsWith('.md'));
  const read = await Promise.all(files.map(async (f) => ({ f, text: await fileOn(env, f, ref) })));
  return read
    .filter(({ text }) => text !== null && isUnreviewed(text))
    .map(({ f }) => ({ file: f, name: reviewableName(f) }))
    .sort((a, b) => reviewableRank(a.file) - reviewableRank(b.file));
}

function runOf(params: Record<string, string | string[]>): string | null {
  const id = Array.isArray(params.run) ? params.run[0] : params.run;
  return isRunId(id) ? id : null;
}

export const onRequestGet: Handler = async ({ env, params }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const id = runOf(params);
  if (id === null) return problem('That is not a run.', 400);
  const run = await gateRun(db, id);
  if (!run) return problem('The studio has no run by that name.', 404);
  const opened = run.events.find((e) => e.type === 'gate.opened');
  if (opened?.type !== 'gate.opened') return problem('That run is not a gate.', 400);
  try {
    const pull = await pullHolding(env, `thoughts/${run.thought}/ledger/${id}.jsonl`, run.thought);
    const context = gateContext(opened.node);
    const text = context
      ? await fileOn(env, `thoughts/${run.thought}/${context.file}`, pull?.branch ?? 'main')
      : null;
    const unreviewed =
      opened.node === 'merge' && pull ? await unreviewedOn(env, run.thought, pull.branch) : [];
    return json({
      pull: pull ? { number: pull.number, url: pull.url } : null,
      context: context && text !== null ? { label: context.label, text: bodyOf(text) } : null,
      unreviewed,
    });
  } catch (error: unknown) {
    return problem(error instanceof Error ? error.message : 'GitHub could not be asked.', 502);
  }
};

export const onRequestPost: Handler = async ({ request, env, params }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const id = runOf(params);
  if (id === null) return problem('That is not a run.', 400);
  const by = signedInEmail(request, env);
  if (!isPerson(by))
    return problem(
      env.DEV_SKIP_ACCESS === '1'
        ? 'A gate is closed only by a person (RB080). In local dev, set DEV_EMAIL in site/.dev.vars to who you are.'
        : 'A gate is closed only by a person signed in through Cloudflare Access (RB080).',
      403,
    );
  const parsed = readGateRequest(await request.json().catch(() => null));
  if (!parsed.ok) return problem(parsed.error, 400);
  const { decision, words, medium, key, reviewed } = parsed.value;

  const run = await gateRun(db, id);
  if (!run) return problem('The studio has no run by that name.', 404);
  // The same check the workflow makes, so a decision that cannot stand is refused here, not a minute later.
  const closing = closeGate(run.events, { decision, words, by });
  if (!closing.ok) return problem(closing.error, 409);
  // Only this post's own files, and only with the approval that merges it.
  const opened = run.events.find((e) => e.type === 'gate.opened');
  const node = opened?.type === 'gate.opened' ? opened.node : '';
  if (reviewed.length > 0 && node !== 'merge')
    return problem('Files are marked reviewed only at the gate before the way out.', 400);
  const marking = reviewableIn(reviewed, run.thought);
  if (!marking.ok) return problem(marking.error, 400);

  try {
    const pull = await pullHolding(env, `thoughts/${run.thought}/ledger/${id}.jsonl`, run.thought);
    const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: { ...githubHeaders(env), 'content-type': 'application/json' },
      body: JSON.stringify({
        event_type: 'close-gate',
        client_payload: {
          run: id,
          thought: run.thought,
          decision,
          words,
          by,
          branch: pull?.branch ?? '',
          medium,
          ...(key ? { key } : {}),
          ...(marking.files.length > 0 ? { reviewed: marking.files } : {}),
        },
      }),
    });
    if (!response.ok)
      return problem(
        `GitHub refused the dispatch: ${String(response.status)} ${await response.text()}`,
        502,
      );
    return json({ sent: true, pull: pull ? { number: pull.number, url: pull.url } : null }, 202);
  } catch (error: unknown) {
    return problem(error instanceof Error ? error.message : 'GitHub could not be asked.', 502);
  }
};
