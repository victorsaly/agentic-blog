// Why: the studio's tab row and its overview say how many comments wait for Victor, on every studio page.
// Listing them all just to count would be wasteful, so this answers with the number alone. Behind
// Cloudflare Access like the rest of /api/*.
import { json, problem, type Handler } from '../../_lib';

export const onRequestGet: Handler = async ({ env }) => {
  if (!env.COMMENTS_DB) return problem('Comments are not set up on this deployment.', 503);
  try {
    const row = await env.COMMENTS_DB.prepare(
      `SELECT COUNT(*) AS pending FROM comments WHERE status = 'pending'`,
    ).first<{ pending: number }>();
    return json({ pending: row?.pending ?? 0 });
  } catch {
    return problem('The comments table is missing. Apply the migration (see the README).', 503);
  }
};
