// Why: Victor marks what he has read from the studio instead of editing YAML. Like an origin, the change
// lands only as a pull request he merges: this function checks the files are versions or sources, then asks
// GitHub to run the review workflow, which flips the flags and opens the pull request, so the repo's history
// shows who marked what. Cloudflare Access sits in front of /api/*.
import { readReviewRequest } from '../../src/lib/review';
import { json, problem, signedInEmail, type Handler } from '../_lib';

export const onRequestPost: Handler = async ({ request, env }) => {
  if (!env.GITHUB_TOKEN) return problem('GITHUB_TOKEN is not set for this deployment.', 500);
  const asked = readReviewRequest(await request.json().catch(() => null));
  if (!asked.ok) return problem(asked.error, 400);

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
      event_type: 'mark-reviewed',
      client_payload: { files: asked.files, by: signedInEmail(request) },
    }),
  });
  if (!response.ok)
    return problem(
      `GitHub refused the dispatch: ${String(response.status)} ${await response.text()}`,
      502,
    );
  // The workflow opens the pull request a few seconds later; the list of review pull requests is where it lands.
  return json(
    {
      files: asked.files,
      prUrl: `https://github.com/${env.GITHUB_REPO}/pulls?q=is%3Apr+is%3Aopen+label%3Areview`,
    },
    202,
  );
};
