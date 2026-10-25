// Why: a transcript becomes an origin only by landing in the repo as a pull request Victor merges. This
// function does nothing itself except ask GitHub to run the origin workflow with the key and the text;
// the workflow writes the files, so the repo's history shows who asked for what. Text that was written or
// transcribed elsewhere comes through here too, with no key, and is marked as text all the way down. GitHub
// opens the pull request a minute or so later, so the send answers with when it asked, and GET finds the pull
// request opened since then: the studio says it is open only once it is.
import { parseOriginRequest } from '../../src/lib/origin-request';
import { pullOpenedSince } from '../../src/lib/opened-pull';
import { githubHeaders } from '../_github';
import { json, problem, signedInEmail, type Handler } from '../_lib';

/** The pull request the studio's send opened, once GitHub has opened it: ?label=origin&since=<ISO time>. */
export const onRequestGet: Handler = async ({ request, env }) => {
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const url = new URL(request.url);
  const label = url.searchParams.get('label');
  const since = url.searchParams.get('since') ?? '';
  if ((label !== 'origin' && label !== 'feedback') || Number.isNaN(Date.parse(since)))
    return problem('Say which label (origin or feedback) and since when.', 400);
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/pulls?state=open&sort=created&direction=desc&per_page=20`,
    { headers: githubHeaders(env) },
  );
  if (!response.ok)
    return problem(`GitHub did not list the pull requests (${String(response.status)}).`, 502);
  return json({ pull: pullOpenedSince(await response.json(), label, since) });
};

export const onRequestPost: Handler = async ({ request, env }) => {
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseOriginRequest(body);
  if (!parsed.ok) return problem(parsed.error, 400);
  const { medium, key, transcript, mode, thought } = parsed.value;
  const asked = new Date().toISOString();

  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'agentic-blog-studio',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: mode === 'origin' ? 'new-origin' : 'new-feedback',
      client_payload: {
        medium,
        key,
        transcript,
        thought,
        by: signedInEmail(request),
        recorded: asked,
      },
    }),
  });

  if (!response.ok) {
    return problem(
      `GitHub refused the dispatch: ${String(response.status)} ${await response.text()}`,
      502,
    );
  }
  // The workflow opens the pull request a minute or so later; the studio asks GET for it from here.
  return json(
    {
      asked,
      label: mode,
      list: `https://github.com/${env.GITHUB_REPO}/pulls?q=is%3Apr+is%3Aopen+label%3A${mode}`,
    },
    202,
  );
};
