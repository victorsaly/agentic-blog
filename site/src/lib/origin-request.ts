// Why: the studio sends two kinds of origin, a recording with its transcript or text that was written or
// transcribed somewhere else. One pure function decides what a valid request is, so the rule is tested
// on its own and the edge function only does the side effect.

export type Medium = 'voice' | 'text';

export interface OriginRequest {
  medium: Medium;
  /** R2 key of the recording; null when the origin arrived as text. */
  key: string | null;
  transcript: string;
  mode: 'origin' | 'feedback';
  thought: string | null;
}

export type Parsed = { ok: true; value: OriginRequest } | { ok: false; error: string };

const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const SAFE_KEY = /^(origin|feedback)\/[A-Za-z0-9-]+\.(webm|m4a|mp3|wav|ogg)$/;

/** A long voice note runs to a few thousand words; this is far above that and well under GitHub's limit. */
export const MAX_TEXT_LENGTH = 50_000;

export function isSafeKey(key: string): boolean {
  return SAFE_KEY.test(key);
}

function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

export function parseOriginRequest(body: unknown): Parsed {
  const medium: Medium = field(body, 'medium') === 'text' ? 'text' : 'voice';
  const rawKey = field(body, 'key');
  const rawTranscript = field(body, 'transcript');
  const rawThought = field(body, 'thought');
  const mode = field(body, 'mode') === 'feedback' ? 'feedback' : 'origin';
  const transcript = typeof rawTranscript === 'string' ? rawTranscript.trim() : '';
  const thought = typeof rawThought === 'string' && SLUG.test(rawThought) ? rawThought : null;

  let key: string | null = null;
  if (medium === 'voice') {
    if (typeof rawKey !== 'string' || !isSafeKey(rawKey))
      return { ok: false, error: 'A valid recording key is required.' };
    key = rawKey;
  } else if (rawKey !== undefined && rawKey !== null) {
    return { ok: false, error: 'Text origins have no recording; leave the key out.' };
  }

  if (transcript.length === 0)
    return {
      ok: false,
      error: medium === 'text' ? 'The text is empty.' : 'The transcript is empty.',
    };
  if (transcript.length > MAX_TEXT_LENGTH)
    return {
      ok: false,
      error: `The text is longer than ${String(MAX_TEXT_LENGTH)} characters; split it into two origins.`,
    };
  if (mode === 'feedback' && thought === null)
    return { ok: false, error: 'Feedback needs the thought it is about.' };

  return { ok: true, value: { medium, key, transcript, mode, thought } };
}
