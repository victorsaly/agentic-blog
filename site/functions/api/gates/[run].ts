// Why: the studio's way to answer a gate. GET says what Victor needs beside the question: the pull request
// the gate is on and the file he is answering about (the interview's questions, the structure). POST takes
// his decision, checks that the run is a gate still waiting, that the decision fits what it asks, and that he
// is a person signed in through Access (RB080), and then only asks GitHub to run the gates workflow: the
// workflow writes, so git stays the record and its history shows who decided. Behind Cloudflare Access.
import { closeGate, isPerson, type LedgerEvent } from '@roadbook/core';
import { isRunId } from '../../../src/lib/live-runs';
import { bodyOf, gateContext, readGateRequest } from '../../../src/lib/gates';
import { fileOn, githubHeaders, pullHolding } from '../../_github';
import { json, problem, signedInEmail, type Handler } from '../../_lib';

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
    return json({
      pull: pull ? { number: pull.number, url: pull.url } : null,
      context: context && text !== null ? { label: context.label, text: bodyOf(text) } : null,
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
  const by = signedInEmail(request);
  if (!isPerson(by))
    return problem(
      'A gate is closed only by a person signed in through Cloudflare Access (RB080).',
      403,
    );
  const parsed = readGateRequest(await request.json().catch(() => null));
  if (!parsed.ok) return problem(parsed.error, 400);
  const { decision, words, medium, key } = parsed.value;

  const run = await gateRun(db, id);
  if (!run) return problem('The studio has no run by that name.', 404);
  // The same check the workflow makes, so a decision that cannot stand is refused here, not a minute later.
  const closing = closeGate(run.events, { decision, words, by });
  if (!closing.ok) return problem(closing.error, 409);

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
