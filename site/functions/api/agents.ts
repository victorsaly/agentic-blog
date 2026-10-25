// Why: the studio's Agents area asks here what the agents are doing on GitHub right now: the latest runs of
// the agents workflow, each with its agent, thought and state, and the step it is on when it is running. It
// reads only; the repository is public, so the studio's token needs no extra permission (if the repository
// is ever made private, the token needs Actions: read). Behind Cloudflare Access like the rest of /api/*.
import {
  isShown,
  liveRunOf,
  needsSteps,
  readRuns,
  readSteps,
  type RawStep,
} from '../../src/lib/agent-runs';
import { json, problem, type Handler } from '../_lib';

/** Enough to see today's work; older runs are in the ledgers. */
const RUNS = 20;
/** At most this many runs are asked for their steps per call, to stay well inside GitHub's rate limit. */
const STEP_LOOKUPS = 6;

export const onRequestGet: Handler = async ({ env }) => {
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'user-agent': 'agentic-blog-studio',
    'x-github-api-version': '2022-11-28',
  };
  const base = `https://api.github.com/repos/${env.GITHUB_REPO}/actions`;

  const response = await fetch(`${base}/workflows/agents.yml/runs?per_page=${String(RUNS)}`, {
    headers,
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return problem(
      'GitHub would not show the agent runs to the studio. If the repository is private, give its token Actions: read.',
      502,
    );
  }
  if (!response.ok)
    return problem(`GitHub did not answer (${String(response.status)}). Try again.`, 502);

  const runs = readRuns(await response.json()).filter(isShown);
  const lookups = runs.filter(needsSteps).slice(0, STEP_LOOKUPS);
  const steps = new Map<number, RawStep[]>(
    await Promise.all(
      lookups.map(async (run): Promise<[number, RawStep[]]> => {
        const jobs = await fetch(`${base}/runs/${String(run.id)}/jobs`, { headers });
        return [run.id, jobs.ok ? readSteps(await jobs.json()) : []];
      }),
    ),
  );

  return json({ runs: runs.map((run) => liveRunOf(run, steps.get(run.id))) });
};
