// Why: the four functions share one set of bindings, one JSON helper and one access check. Cloudflare Access
// does the real authentication at the edge; the check here only refuses requests that arrive without the
// header Access adds, so a misconfigured route cannot quietly expose the studio API.

export interface Env {
  AUDIO: R2Bucket;
  AI: { run: (model: string, inputs: Record<string, unknown>) => Promise<unknown> };
  GITHUB_REPO: string;
  GITHUB_TOKEN?: string;
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
  return request.headers.has('cf-access-jwt-assertion') || request.headers.has('cf-access-authenticated-user-email');
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

const SAFE_KEY = /^(origin|feedback)\/[A-Za-z0-9-]+\.(webm|m4a|mp3|wav|ogg)$/;

export function isSafeKey(key: string): boolean {
  return SAFE_KEY.test(key);
}
