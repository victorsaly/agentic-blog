// Why: a transcript becomes an origin only by landing in the repo as a pull request Victor merges. This
// function does nothing itself except ask GitHub to run the origin workflow with the key and the text;
// the workflow writes the files, so the repo's history shows who asked for what.
import { isSafeKey, json, problem, signedInEmail, type Handler } from '../_lib';

interface Body {
  key?: unknown;
  transcript?: unknown;
  mode?: unknown;
  thought?: unknown;
}

const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

export const onRequestPost: Handler = async ({ request, env }) => {
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const body = (await request.json().catch(() => ({}))) as Body;
  const key = typeof body.key === 'string' ? body.key : '';
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  const mode = body.mode === 'feedback' ? 'feedback' : 'origin';
  const thought = typeof body.thought === 'string' && SLUG.test(body.thought) ? body.thought : null;

  if (!isSafeKey(key)) return problem('A valid recording key is required.', 400);
  if (transcript.length === 0) return problem('The transcript is empty.', 400);
  if (mode === 'feedback' && thought === null) return problem('Feedback needs the thought it is about.', 400);

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
      client_payload: { key, transcript, thought, by: signedInEmail(request), recorded: new Date().toISOString() },
    }),
  });

  if (!response.ok) {
    return problem(`GitHub refused the dispatch: ${String(response.status)} ${await response.text()}`, 502);
  }
  // The workflow opens the PR a few seconds later; the pulls page is the honest place to send the person.
  return json({ prUrl: `https://github.com/${env.GITHUB_REPO}/pulls?q=is%3Apr+is%3Aopen+label%3A${mode}` }, 202);
};
