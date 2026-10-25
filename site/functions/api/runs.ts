// Why: the studio's Agents board asks here which runs are going and how the latest ones ended, from the live
// copy the runner fills as it goes (see runs/[id]/events.ts), so a run on Victor's computer shows within
// seconds instead of after its pull request is merged and deployed. It reads only. The newest runs come
// first; older ones are in the ledgers and on the Runs page. Behind Cloudflare Access like the rest of /api/*.
import { rowOf, type RunRecord } from '../../src/lib/live-runs';
import { json, problem, type Handler } from '../_lib';

/** Enough for what is going now and the day's work behind it. */
const RUNS = 40;

export const onRequestGet: Handler = async ({ env }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  try {
    const { results } = await db
      .prepare('SELECT * FROM runs ORDER BY updated_at DESC LIMIT ?1')
      .bind(RUNS)
      .all<RunRecord>();
    return json({ runs: results.map(rowOf) });
  } catch {
    return problem('The runs table is missing. Apply the migrations (see the README).', 503);
  }
};
