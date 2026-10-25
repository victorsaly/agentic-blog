// Why: the run goes on by itself. After an agent is done (agents.yml) or a gate is closed (gates.yml), the
// steps named as next are started on the same branch, one dispatch each, and each queues behind this job
// (same concurrency key). The names come from the runner's summary (RESULT, its last JSON line) or from
// the gate closer (NEXT, space-separated). It only asks GitHub; the agents workflow does the work.
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const branch = process.env.BRANCH;
const thought = process.env.THOUGHT;

/** The steps to start: NEXT as given, or the "next" of the last JSON line the runner printed. */
function nextSteps() {
  if (process.env.NEXT) return process.env.NEXT.split(/\s+/).filter(Boolean);
  const last = (process.env.RESULT ?? '')
    .split('\n')
    .reverse()
    .find((line) => line.trim().startsWith('{'));
  if (!last) return [];
  const next = JSON.parse(last).next;
  return Array.isArray(next) ? next.filter((s) => typeof s === 'string') : [];
}

const steps = nextSteps().filter((s) => /^[a-z][a-z-]*$/.test(s));
if (steps.length === 0) {
  console.info('Nothing starts next.');
  process.exit(0);
}
if (!repo || !token || !branch || !thought) {
  console.error('::error::start-next needs GITHUB_REPOSITORY, GH_TOKEN, BRANCH and THOUGHT.');
  process.exit(1);
}
for (const agent of steps) {
  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ event_type: 'run-agent', client_payload: { agent, thought, branch } }),
  });
  if (!response.ok) {
    console.error(
      `::error::${agent} did not start: GitHub said ${String(response.status)} ${await response.text()}`,
    );
    process.exitCode = 1;
  } else console.info(`Started ${agent} on ${branch}.`);
}
