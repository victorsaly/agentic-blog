// Why: the four functions share one set of bindings, one JSON helper and one access check. Cloudflare Access
// does the real authentication at the edge; the check here only refuses requests that arrive without the
// header Access adds, so a misconfigured route cannot quietly expose the studio API.

export interface Env {
  AUDIO: R2Bucket;
  AI: { run: (model: string, inputs: Record<string, unknown>) => Promise<unknown> };
  GITHUB_REPO: string;
  GITHUB_TOKEN?: string;
  /** The chat's key; a secret on the Worker, with a spend limit set on the key in the Anthropic console. */
  ANTHROPIC_API_KEY?: string;
  /** Cloudflare's in-memory rate limiter for the chat: a burst limit per visitor, nothing stored. */
  CHAT_LIMIT?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  /** Reader comments. Missing until the database is created and bound; every comment route then says so plainly. */
  COMMENTS_DB?: D1Database;
  /** A burst limit per visitor on posting a comment, counted in Cloudflare's memory only. */
  COMMENT_LIMIT?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  /** Turnstile's secret, a Worker secret; the public site key is the plain variable below. */
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  ASSETS: { fetch: (input: URL | Request | string) => Promise<Response> };
  /** Set to "1" in .dev.vars only. wrangler never deploys that file, so production never sees it. */
  DEV_SKIP_ACCESS?: string;
}

export type Handler = PagesFunction<Env>;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function problem(message: string, status: number): Response {
  return json({ error: message }, status);
}

/** True when the request came through Cloudflare Access (it sets this header on every allowed request). */
export function cameThroughAccess(request: Request): boolean {
  return (
    request.headers.has('cf-access-jwt-assertion') ||
    request.headers.has('cf-access-authenticated-user-email')
  );
}

/** The signed-in person, as Access reports it; "unknown" in local dev where Access is not in front. */
export function signedInEmail(request: Request): string {
  return request.headers.get('cf-access-authenticated-user-email') ?? 'unknown';
}

/** R2 keys are dated and random so two recordings can never collide or be guessed. */
export function newAudioKey(mode: 'origin' | 'feedback', extension: string): string {
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const random = crypto.randomUUID().slice(0, 8);
  return `${mode}/${stamp}-${random}.${extension}`;
}

export { isSafeKey } from '../src/lib/origin-request';
