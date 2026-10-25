// Why: Victor reads the comments that are waiting, with the email only he may see, from the studio.
// Cloudflare Access sits in front of /api/*; this route lists what is waiting or already approved, newest
// first, a page at a time so a long list never loads all at once.
import { PAGE_SIZE, pageOf, parseCursor, parseStatus, toOwner } from '../../src/lib/comments';
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
  const { searchParams } = new URL(request.url);
  const status = parseStatus(searchParams.get('status'));
  // ?before=<id of the last comment already shown>
  const before = parseCursor(searchParams.get('before'));
  if (before === undefined) return problem('That is not a place in the comments.', 400);
  try {
    const { results } = await env.COMMENTS_DB.prepare(
      `SELECT id, slug, name, email, body, status, created_at FROM comments
       WHERE status = ?1 AND id < ?2 ORDER BY id DESC LIMIT ?3`,
    )
      .bind(status, before ?? Number.MAX_SAFE_INTEGER, PAGE_SIZE + 1)
      .all<OwnerRow>();
    const page = pageOf(results, PAGE_SIZE);
    return json({ comments: page.rows.map(toOwner), next: page.next });
  } catch {
    return problem('The comments table is missing. Apply the migration (see the README).', 503);
  }
};
