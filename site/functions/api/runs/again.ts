// Why: when an agent does not finish, or a guard holds, Victor runs it again from the studio, on the thought's
// open pull request, the way the run goes on by itself (run-agent, agents.yml); before, someone had to start
// it by hand. Only a person signed in through Access can, and only when the step's allowance still fits under
// the month's cap, counted from the live copy: the runner checks again before every call. Nothing else.
import { isPerson } from '@roadbook/core';
import project from '../../../../roadbook.config';
import { againAllowed, allowanceOf, readAgainRequest } from '../../../src/lib/run-again';
import { githubHeaders, pullFor } from '../../_github';
import { json, problem, signedInEmail, type Handler } from '../../_lib';

export const onRequestPost: Handler = async ({ request, env }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  if (!isPerson(signedInEmail(request, env)))
    return problem('Only a person signed in through Cloudflare Access can start a run.', 403);
  const parsed = readAgainRequest(await request.json().catch(() => null));
  if (!parsed.ok) return problem(parsed.error, 400);
  const { agent, thought } = parsed.value;

  const workflow = project.workflows.find((w) => w.id === 'blog-post');
  if (!workflow) return problem('The project has no blog-post workflow.', 500);
  if (allowanceOf(workflow, agent) === null)
    return problem(`${agent} is not an agent of this workflow.`, 400);
  const month = new Date().toISOString().slice(0, 7);
  let spent: number;
  try {
    const row = await db
      .prepare('SELECT COALESCE(SUM(usd), 0) AS spent FROM runs WHERE started_at >= ?1')
      .bind(`${month}-01`)
      .first<{ spent: number }>();
    spent = row?.spent ?? 0;
  } catch {
    // Without the month's spend the cap cannot be checked, so nothing starts.
    return problem('The studio could not read this month’s spend, so nothing was started.', 503);
  }
  const allowed = againAllowed(workflow, agent, spent, project.budget.monthlyCapUsd);
  if (!allowed.ok) return problem(allowed.error, 409);

  try {
    const pull = await pullFor(env, thought);
    if (!pull)
      return problem(
        'This thought has no open pull request to run on; once merged, its work is done.',
        409,
      );
    const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: { ...githubHeaders(env), 'content-type': 'application/json' },
      body: JSON.stringify({
        event_type: 'run-agent',
        client_payload: { agent, thought, branch: pull.branch },
      }),
    });
    if (!response.ok)
      return problem(
        `GitHub refused to start it: ${String(response.status)} ${await response.text()}`,
        502,
      );
    return json(
      { pull: { number: pull.number, url: pull.url }, allowance: allowed.allowance },
      202,
    );
  } catch (error: unknown) {
    return problem(error instanceof Error ? error.message : 'GitHub could not be asked.', 502);
  }
};
