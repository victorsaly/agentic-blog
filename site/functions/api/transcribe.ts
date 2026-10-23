// Why: the transcript is the first conversion. Workers AI Whisper runs on the platform, costs pennies, and
// gives word timestamps, which is how pauses become punctuation later. The text is returned untouched.
import { isSafeKey, json, problem, type Handler } from '../_lib';

interface Body {
  key?: unknown;
}

interface WhisperResult {
  text?: string;
  words?: { word: string; start: number; end: number }[];
}

/** Base64 in chunks: a forty-minute recording is millions of bytes, far too many for one spread call. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export const onRequestPost: Handler = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as Body;
  const key = typeof body.key === 'string' ? body.key : '';
  if (!isSafeKey(key)) return problem('A valid recording key is required.', 400);

  const object = await env.AUDIO.get(key);
  if (!object) return problem('No recording with that key.', 404);

  const bytes = new Uint8Array(await object.arrayBuffer());
  const result = (await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
    audio: toBase64(bytes),
  })) as WhisperResult;

  const text = (result.text ?? '').trim();
  if (text.length === 0) return problem('The model heard nothing. Try again closer to the microphone.', 422);

  await env.AUDIO.put(`${key}.json`, JSON.stringify({ text, words: result.words ?? [] }), {
    httpMetadata: { contentType: 'application/json' },
  });
  return json({ text, words: result.words ?? [] });
};
