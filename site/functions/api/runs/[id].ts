// Why: one run's timeline, event for event as the runner sent it, for the studio's run page. The page asks
// again while the run is going, passing the last position it has (?after=), so each answer carries only what
// is new. Every event here was checked against the chain when it was kept, so it is the ledger's own words.
// Reads only; behind Cloudflare Access like the rest of /api/*.
import { isRunId, rowOf, type RunRecord } from '../../../src/lib/live-runs';
import { json, problem, type Handler } from '../../_lib';

/** Events per answer; a longer run is read in turns (the answer says when there is more). */
const PAGE = 500;

export const onRequestGet: Handler = async ({ request, env, params }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!isRunId(id)) return problem('That is not a run.', 400);
  const raw = new URL(request.url).searchParams.get('after');
  const after = raw === null ? -1 : Number(raw);
  if (!Number.isInteger(after) || after < -1)
    return problem('Ask for events after a position.', 400);

  try {
    const record = await db.prepare('SELECT * FROM runs WHERE id = ?1').bind(id).first<RunRecord>();
    if (!record)
      return problem(
        'The studio has no run by that name. A run shows here once the runner sends it; older runs come back with npm run live:rebuild.',
        404,
      );
    const { results } = await db
      .prepare('SELECT event FROM run_events WHERE run_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3')
      .bind(id, after, PAGE + 1)
      .all<{ event: string }>();
    const events = results.slice(0, PAGE).map((r): unknown => JSON.parse(r.event));
    return json({ run: rowOf(record), events, more: results.length > PAGE });
  } catch {
    return problem('The runs table is missing. Apply the migrations (see the README).', 503);
  }
};
