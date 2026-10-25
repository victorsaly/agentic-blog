// Why: approving a comment is what makes it public, and refusing one removes it, so both are Victor's act
// alone, behind Cloudflare Access. Nothing here can be reached by a reader.
import { isApproval, parseId } from '../../../src/lib/comments';
import { json, problem, type Handler } from '../../_lib';

export const onRequestPost: Handler = async ({ request, env, params }) => {
  if (!env.COMMENTS_DB) return problem('Comments are not set up on this deployment.', 503);
  const id = parseId(params.id);
  if (id === null) return problem('That is not a comment.', 400);
  if (!isApproval(await request.json().catch(() => null)))
    return problem('The only decision here is "approve". To refuse a comment, delete it.', 400);

  const result = await env.COMMENTS_DB.prepare(
    `UPDATE comments SET status = 'approved', decided_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE id = ?1`,
  )
    .bind(id)
    .run();
  if (result.meta.changes === 0) return problem('That comment is gone.', 404);
  return json({ id, status: 'approved' });
};

export const onRequestDelete: Handler = async ({ env, params }) => {
  if (!env.COMMENTS_DB) return problem('Comments are not set up on this deployment.', 503);
  const id = parseId(params.id);
  if (id === null) return problem('That is not a comment.', 400);
  const result = await env.COMMENTS_DB.prepare('DELETE FROM comments WHERE id = ?1').bind(id).run();
  if (result.meta.changes === 0) return problem('That comment is gone.', 404);
  return json({ id, deleted: true });
};
