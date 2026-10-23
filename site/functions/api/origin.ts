// Why: a transcript becomes an origin only by landing in the repo as a pull request Victor merges. This
// function does nothing itself except ask GitHub to run the origin workflow with the key and the text;
// the workflow writes the files, so the repo's history shows who asked for what. Text that was written or
// transcribed elsewhere comes through here too, with no key, and is marked as text all the way down.
import { parseOriginRequest } from '../../src/lib/origin-request';
import { json, problem, signedInEmail, type Handler } from '../_lib';

export const onRequestPost: Handler = async ({ request, env }) => {
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseOriginRequest(body);
  if (!parsed.ok) return problem(parsed.error, 400);
  const { medium, key, transcript, mode, thought } = parsed.value;

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
        recorded: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    return problem(
      `GitHub refused the dispatch: ${String(response.status)} ${await response.text()}`,
      502,
    );
  }
  // The workflow opens the PR a few seconds later; the pulls page is the honest place to send the person.
  return json(
    { prUrl: `https://github.com/${env.GITHUB_REPO}/pulls?q=is%3Apr+is%3Aopen+label%3A${mode}` },
    202,
  );
};
