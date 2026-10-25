// Why: the runner sends each ledger event here as it records it, so the studio sees a run while it happens.
// Every event is checked against the chain (see src/lib/live-runs.ts) before it is kept, and the run's row
// is brought up to date in the same transaction, so the two never disagree. A resend changes nothing; two
// sends racing for the same place are settled by the database (the second is refused and simply sends
// again). Reached through Cloudflare Access like the rest of /api/*: from GitHub Actions or Victor's
// computer with an Access service token. The live copy lives in the studio's one database, whose binding is
// named for the comments that came first.
import {
  checkAppend,
  isRunId,
  readAppendRequest,
  summarise,
  GENESIS,
  type LiveRunRow,
} from '../../../../src/lib/live-runs';
import { json, problem, type Handler } from '../../../_lib';

/** A few hundred events of a few hundred bytes each, with room to spare. */
const MAX_BYTES = 512 * 1024;

interface RunRecord {
  id: string;
  thought: string;
  agent: string;
  state: string;
  started_at: string;
  updated_at: string;
  usd: number;
  events: number;
  head: string;
}

const rowOf = (r: RunRecord): LiveRunRow => ({
  id: r.id,
  thought: r.thought,
  agent: r.agent,
  state: r.state,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  usd: r.usd,
  events: r.events,
  head: r.head,
});

export const onRequestPost: Handler = async ({ request, env, params }) => {
  const db = env.COMMENTS_DB;
  if (!db) return problem('The studio database is not set up on this deployment.', 503);
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!isRunId(id)) return problem('That is not a run.', 400);
  if (Number(request.headers.get('content-length') ?? '0') > MAX_BYTES)
    return problem('Send fewer events at a time.', 413);
  const parsed = readAppendRequest(await request.json().catch(() => null));
  if (!parsed.ok) return problem(parsed.error, 400);
  const { thought, events } = parsed.value;

  try {
    const record = await db.prepare('SELECT * FROM runs WHERE id = ?1').bind(id).first<RunRecord>();
    const current = record ? rowOf(record) : null;
    if (current && current.thought !== thought)
      return problem(`Run ${id} is on ${current.thought}, not ${thought}.`, 409);
    const kept = { count: current?.events ?? 0, hash: current?.head ?? GENESIS };

    // The hashes already kept for any position sent again, so a resend is told from a change.
    const resent = events.filter((e) => e.seq < kept.count).map((e) => e.seq);
    const known = new Map<number, string>();
    if (resent.length > 0) {
      const { results } = await db
        .prepare('SELECT seq, hash FROM run_events WHERE run_id = ?1 AND seq BETWEEN ?2 AND ?3')
        .bind(id, Math.min(...resent), Math.max(...resent))
        .all<{ seq: number; hash: string }>();
      for (const r of results) known.set(r.seq, r.hash);
    }

    const checked = await checkAppend(kept, known, events);
    if (!checked.ok) return problem(checked.error, checked.status);
    if (checked.fresh.length === 0) return json({ kept: kept.count });

    const row = summarise(current, id, thought, checked.fresh, checked.head);
    await db.batch([
      ...checked.fresh.map((e) =>
        db
          .prepare(
            'INSERT INTO run_events (run_id, seq, at, type, hash, event) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
          )
          .bind(id, e.seq, e.at, e.type, e.hash, JSON.stringify(e)),
      ),
      db
        .prepare(
          `INSERT INTO runs (id, thought, agent, state, started_at, updated_at, usd, events, head)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT (id) DO UPDATE SET state = ?4, updated_at = ?6, usd = ?7, events = ?8, head = ?9`,
        )
        .bind(
          row.id,
          row.thought,
          row.agent,
          row.state,
          row.startedAt,
          row.updatedAt,
          row.usd,
          row.events,
          row.head,
        ),
    ]);
    return json({ kept: row.events });
  } catch (error: unknown) {
    // An event already kept at the same place means another send got there first: the batch was undone.
    if (error instanceof Error && /UNIQUE|constraint/i.test(error.message))
      return problem('Another send reached this run first. Send again from where it stands.', 409);
    return problem('The runs table is missing. Apply the migrations (see the README).', 503);
  }
};
