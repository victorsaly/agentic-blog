// Why: Victor approves the gate before the way out in the studio, and that press is the merge. The gates
// workflow runs this after recording his approval on the pull request's branch: it waits for every check on
// that commit, then merges the pull request, naming him and the gate in the merge commit, so main shows who
// let the post out. A check that does not pass keeps the post out, and says which. It merges the commit it
// waited on and no other: a push in the meantime stops it.
//   GH_TOKEN=… GITHUB_REPOSITORY=owner/repo BRANCH=… BY=… GATE=merge RUN=… npx tsx scripts/merge-approved.ts
import { readCheckRuns, verdictOf } from './checks-verdict';

const {
  GH_TOKEN: token,
  GITHUB_REPOSITORY: repo,
  BRANCH: branch,
  BY: by,
  GATE: gate,
  RUN: run,
} = process.env;
if (!token || !repo || !branch || !by || !gate || !run)
  throw new Error('merge-approved needs GH_TOKEN, GITHUB_REPOSITORY, BRANCH, BY, GATE and RUN.');

const WAIT_MS = 20_000;
const LIMIT_MS = 20 * 60_000;

async function github(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`https://api.github.com/repos/${repo ?? ''}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token ?? ''}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(`GitHub said ${String(response.status)} to ${path}: ${JSON.stringify(data)}`);
  return data;
}

const owner = repo.split('/')[0] ?? '';
const pulls = await github(`/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
const pull: unknown = Array.isArray(pulls) ? pulls[0] : null;
const number = (pull as { number?: unknown } | null)?.number;
const sha = (pull as { head?: { sha?: unknown } } | null)?.head?.sha;
if (typeof number !== 'number' || typeof sha !== 'string')
  throw new Error(`No open pull request for ${branch}; nothing to merge.`);

const started = Date.now();
for (;;) {
  const verdict = verdictOf(readCheckRuns(await github(`/commits/${sha}/check-runs?per_page=100`)));
  if (verdict.kind === 'fail') {
    console.error(`::error::Not merged: ${verdict.failed.join(', ')} did not pass on ${sha}.`);
    process.exit(1);
  }
  if (verdict.kind === 'pass') break;
  if (Date.now() - started > LIMIT_MS) {
    console.error(`::error::Not merged: the checks on ${sha} were still going after 20 minutes.`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
}

await github(`/pulls/${String(number)}/merge`, {
  method: 'PUT',
  body: JSON.stringify({
    merge_method: 'merge',
    sha,
    commit_title: `Merge pull request #${String(number)} from ${owner}/${branch}`,
    commit_message: `Merged on ${by}'s approval at the ${gate} gate in the studio (run ${run}).`,
  }),
});
console.info(`Merged #${String(number)} on ${by}'s approval.`);
