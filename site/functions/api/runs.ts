// Why: the studio's Agents board asks here which runs are going and how the latest ones ended, from the live
// copy the runner fills as it goes (see runs/[id]/events.ts), so a run on Victor's computer shows within
// seconds instead of after its pull request is merged and deployed. It reads only. Recent history is
// limited; outstanding work is not: the latest run of each agent on each thought that is still going, needs
// Victor, holds the post or did not finish is always sent, however many runs came after it. Each run says whether it is that
// latest one (by when it started), so the board can tell a standing hold from an old one. Beside them, where
// every thought stands: each agent's latest run on each thought and how many it has made, which is the
// pipeline, read live instead of as of the last deploy. Behind Cloudflare Access like the rest of /api/*.
import { rowOf, type RunRecord } from '../../src/lib/live-runs';
import { json, problem, type Handler } from '../_lib';

/** Enough history for the day's work; outstanding runs come on top of it. */
const RUNS = 40;

/** States that still ask something of someone: the run is going, waiting on Victor, or holding the post. */
// Every state that still asks for something, a run that did not finish included: it stands until the step
// runs again, however many runs come after it.
const OUTSTANDING = ['idle', 'waiting', 'running', 'needs-you', 'held', 'failed'];

const LATEST =
  'started_at = (SELECT MAX(r2.started_at) FROM runs r2 WHERE r2.thought = runs.thought AND r2.agent = runs.agent)';

export const onRequestGet: Handler = async ({ env }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  const states = OUTSTANDING.map((_, i) => `?${String(i + 2)}`).join(', ');
  try {
    const { results } = await db
      .prepare(
        `SELECT runs.*, (${LATEST}) AS latest FROM runs
         WHERE id IN (SELECT id FROM runs ORDER BY updated_at DESC LIMIT ?1)
            OR (state IN (${states}) AND ${LATEST})
         ORDER BY updated_at DESC`,
      )
      .bind(RUNS, ...OUTSTANDING)
      .all<RunRecord & { latest: number }>();
    const standing = await db
      .prepare(
        `SELECT runs.id, runs.thought, runs.agent, runs.state, runs.started_at, counted.runs FROM runs
         JOIN (SELECT thought, agent, MAX(started_at) AS started, COUNT(*) AS runs FROM runs GROUP BY thought, agent) counted
           ON runs.thought = counted.thought AND runs.agent = counted.agent AND runs.started_at = counted.started`,
      )
      .all<{
        id: string;
        thought: string;
        agent: string;
        state: string;
        started_at: string;
        runs: number;
      }>();
    return json({
      runs: results.map((r) => ({ ...rowOf(r), latest: r.latest === 1 })),
      standing: standing.results.map((r) => ({
        id: r.id,
        thought: r.thought,
        agent: r.agent,
        state: r.state,
        startedAt: r.started_at,
        runs: r.runs,
      })),
    });
  } catch {
    return problem('The runs table is missing. Apply the migrations (see the README).', 503);
  }
};
