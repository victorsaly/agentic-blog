// Why: Victor reads the comments that are waiting, with the email only he may see, from the studio.
// Cloudflare Access sits in front of /api/*; this route lists what is waiting or already approved.
import { parseStatus, toOwner } from '../../src/lib/comments';
import { json, problem, type Handler } from '../_lib';

interface OwnerRow {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  body: string;
  status: string;
  created_at: string;
}

export const onRequestGet: Handler = async ({ request, env }) => {
  if (!env.COMMENTS_DB) return problem('Comments are not set up on this deployment.', 503);
  const status = parseStatus(new URL(request.url).searchParams.get('status'));
  try {
    const { results } = await env.COMMENTS_DB.prepare(
      `SELECT id, slug, name, email, body, status, created_at FROM comments
       WHERE status = ?1 ORDER BY created_at DESC, id DESC LIMIT 200`,
    )
      .bind(status)
      .all<OwnerRow>();
    return json({ comments: results.map(toOwner) });
  } catch {
    return problem('The comments table is missing. Apply the migration (see the README).', 503);
  }
};
