// Why: the reader's side of the comments. A visitor reads the approved comments under a post and may leave
// one; it is stored as waiting and nobody sees it until Victor approves it in the studio. The public reply
// carries a name, the words and a date, never the email. Spam is kept out by a hidden field, a per-visitor
// burst limit and Turnstile; the route is closed until the blog is public, as the chat is.
import {
  MAX_REQUEST_BYTES,
  PAGE_SIZE,
  isThoughtSlug,
  pageOf,
  parseCommentRequest,
  parseCursor,
  toPublic,
  type PublicComment,
} from '../../src/lib/comments';
import { readBoundedText } from '../../src/lib/read-bounded';
import { verifyTurnstile } from '../../src/lib/turnstile';
import { json, problem, type Env, type Handler } from '../_lib';

interface PublicRow {
  id: number;
  name: string;
  body: string;
  created_at: string;
}

const THANKS = 'Thank you. Victor reads every comment first, so yours will show once he has.';

/** The posts that exist and whether the blog is public, from the same corpus the chat reads. */
async function readCorpus(
  env: Env,
  request: Request,
): Promise<{ open: boolean; slugs: Set<string> } | null> {
  const response = await env.ASSETS.fetch(new URL('/ask-corpus.json', request.url));
  const data: unknown = response.ok ? await response.json() : null;
  if (typeof data !== 'object' || data === null) return null;
  const { open, posts } = data as { open?: unknown; posts?: unknown };
  if (!Array.isArray(posts)) return null;
  const slugs = new Set<string>();
  for (const post of posts) {
    const slug = (post as { slug?: unknown } | null)?.slug;
    if (typeof slug === 'string') slugs.add(slug);
  }
  return { open: open === true, slugs };
}

export const onRequestGet: Handler = async ({ request, env, params }) => {
  const slug = params.slug;
  if (!isThoughtSlug(slug)) return problem('That is not a post.', 404);

  if (!env.COMMENTS_DB) return json({ comments: [], siteKey: null, next: null });
  const siteKey = env.TURNSTILE_SITE_KEY ?? null;
  const ready = siteKey !== null && env.TURNSTILE_SECRET !== undefined;

  // Oldest first, a page at a time: ?after=<id of the last comment already shown>.
  const after = parseCursor(new URL(request.url).searchParams.get('after'));
  if (after === undefined) return problem('That is not a place in the comments.', 400);

  let comments: PublicComment[] = [];
  let next: number | null = null;
  try {
    const { results } = await env.COMMENTS_DB.prepare(
      `SELECT id, name, body, created_at FROM comments
       WHERE slug = ?1 AND status = 'approved' AND id > ?2 ORDER BY id ASC LIMIT ?3`,
    )
      .bind(slug, after ?? 0, PAGE_SIZE + 1)
      .all<PublicRow>();
    const page = pageOf(results, PAGE_SIZE);
    comments = page.rows.map(toPublic);
    next = page.next;
  } catch {
    // The table is not there yet (migration not applied): show no comments and no form.
    return json({ comments: [], siteKey: null, next: null });
  }
  const corpus = await readCorpus(env, request);
  const open = corpus?.open === true || env.DEV_SKIP_ACCESS === '1';
  return json({ comments, siteKey: ready && open ? siteKey : null, next });
};

export const onRequestPost: Handler = async ({ request, env, params }) => {
  const slug = params.slug;
  if (!isThoughtSlug(slug)) return problem('That is not a post.', 404);
  if (!env.COMMENTS_DB) return problem('Comments are not set up on this deployment.', 503);

  const dev = env.DEV_SKIP_ACCESS === '1';
  const corpus = await readCorpus(env, request);
  if (!corpus) return problem('Comments are not ready yet.', 503);
  if (!corpus.open && !dev) return problem('Comments open when the blog does.', 404);
  if (!corpus.slugs.has(slug)) return problem('That is not a post.', 404);

  const visitor = request.headers.get('cf-connecting-ip') ?? 'local';
  if (env.COMMENT_LIMIT && !(await env.COMMENT_LIMIT.limit({ key: visitor })).success)
    return problem('That is a lot of comments at once. Wait a minute and try again.', 429);

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_REQUEST_BYTES) return problem('That comment is too big.', 413);
  // Content-Length can be missing or false, so the body is also counted as it arrives.
  const raw = await readBoundedText(request, MAX_REQUEST_BYTES);
  if (raw === null) return problem('That comment is too big.', 413);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return problem('That did not arrive as a comment.', 400);
  }

  const parsed = parseCommentRequest(body);
  if (!parsed.ok) return problem(parsed.error, 400);
  // A bot filled the hidden field: say thanks and keep nothing, so it learns nothing.
  if (parsed.value.trap) return json({ message: THANKS }, 202);

  if (env.TURNSTILE_SECRET) {
    const person = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET,
      token: parsed.value.token,
      ip: request.headers.get('cf-connecting-ip'),
    });
    if (!person) return problem('We could not tell you are a person. Reload and try again.', 400);
  } else if (!dev) {
    return problem('Comments are not set up on this deployment.', 503);
  }

  try {
    await env.COMMENTS_DB.prepare(
      'INSERT INTO comments (slug, name, email, body) VALUES (?1, ?2, ?3, ?4)',
    )
      .bind(slug, parsed.value.name, parsed.value.email, parsed.value.body)
      .run();
  } catch {
    return problem('The comment could not be saved just now. Try again later.', 503);
  }
  return json({ message: THANKS }, 202);
};
