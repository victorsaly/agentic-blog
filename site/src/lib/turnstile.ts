// Why: Turnstile is how the comment form tells a person from a script without tracking anyone. The edge
// function asks Cloudflare whether the answer the form sent is real; this is that one question, with the
// network passed in so a test can answer for it.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface VerifyInput {
  secret: string;
  token: string;
  /** The visitor's address, which Cloudflare uses only to judge the answer; it is not kept. */
  ip: string | null;
  fetcher?: typeof fetch;
}

/** True only when Cloudflare says the answer is real. Any failure to ask counts as "not a person". */
export async function verifyTurnstile({
  secret,
  token,
  ip,
  fetcher = fetch,
}: VerifyInput): Promise<boolean> {
  if (token === '') return false;
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const reply = await fetcher(VERIFY_URL, { method: 'POST', body: form });
    if (!reply.ok) return false;
    const data: unknown = await reply.json();
    return (
      typeof data === 'object' && data !== null && (data as { success?: unknown }).success === true
    );
  } catch {
    return false;
  }
}
