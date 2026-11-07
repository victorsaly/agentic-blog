// Why: Victor approves the gate before the way out in the studio, and that press is the merge. The gates
// workflow runs this after recording his approval on the pull request's branch: it waits for every check on
// that commit, then merges the pull request, naming him and the gate in the merge commit, so main shows who
// let the post out. A check that does not pass keeps the post out, and says which. It merges the commit that
// recorded the approval and no other: if the pull request has moved past it, nothing is merged. It waits for
// the required checks by name (REQUIRED_CHECKS, one per line), so a check that registers late is not missed.
// GitHub can lag the approval push by a moment, so it waits (briefly) for the pull request to show it.
//   GH_TOKEN=… GITHUB_REPOSITORY=owner/repo BRANCH=… APPROVED_SHA=… BY=… GATE=merge RUN=…
//   REQUIRED_CHECKS=… npx tsx scripts/merge-approved.ts
import { headVerdict, readCheckRuns, verdictOf } from './checks-verdict';

const {
  GH_TOKEN: token,
  GITHUB_REPOSITORY: repo,
  BRANCH: branch,
  APPROVED_SHA: approved,
  BY: by,
  GATE: gate,
  RUN: run,
} = process.env;
if (!token || !repo || !branch || !approved || !by || !gate || !run)
  throw new Error(
    'merge-approved needs GH_TOKEN, GITHUB_REPOSITORY, BRANCH, APPROVED_SHA, BY, GATE and RUN.',
  );
const required = (process.env['REQUIRED_CHECKS'] ?? '')
  .split('\n')
  .map((name) => name.trim())
  .filter(Boolean);

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

async function readPull(): Promise<{ number: number; sha: string }> {
  const pulls = await github(
    `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch ?? ''}`)}`,
  );
  const pull: unknown = Array.isArray(pulls) ? pulls[0] : null;
  const number = (pull as { number?: unknown } | null)?.number;
  const sha = (pull as { head?: { sha?: unknown } } | null)?.head?.sha;
  if (typeof number !== 'number' || typeof sha !== 'string')
    throw new Error(`No open pull request for ${branch ?? ''}; nothing to merge.`);
  return { number, sha };
}

async function compareStatus(base: string, head: string): Promise<string | null> {
  const data = await github(`/compare/${base}...${head}`);
  const status = (data as { status?: unknown } | null)?.status;
  return typeof status === 'string' ? status : null;
}

// Only what Victor approved goes out: a push after his approval would go out unread. The approval was
// pushed a moment ago, so GitHub may still show the commit before it; wait for it to catch up.
const HEAD_WAIT_MS = 5_000;
const HEAD_LIMIT_MS = 2 * 60_000;
const asked = Date.now();
let { number, sha } = await readPull();
for (;;) {
  const head = headVerdict(
    sha,
    approved,
    sha === approved ? null : await compareStatus(sha, approved),
  );
  if (head === 'ready') break;
  if (head === 'moved' || Date.now() - asked > HEAD_LIMIT_MS) {
    console.error(
      `::error::Not merged: the pull request moved after the approval (it is at ${sha}, the approval is ${approved}). Approve it again in the studio.`,
    );
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, HEAD_WAIT_MS));
  ({ number, sha } = await readPull());
}

const started = Date.now();
for (;;) {
  const verdict = verdictOf(
    readCheckRuns(await github(`/commits/${sha}/check-runs?per_page=100`)),
    required,
  );
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
