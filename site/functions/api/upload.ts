// Why: the recording is the true origin, so the first thing the studio does is put it somewhere it cannot
// be edited or lost. One object per recording in R2, keyed by date and a random suffix.
import { isSafeKey, json, newAudioKey, problem, signedInEmail, type Handler } from '../_lib';

const MAX_BYTES = 200 * 1024 * 1024; // forty minutes of talking is well under this

export const onRequestPost: Handler = async ({ request, env }) => {
  const form = await request.formData().catch(() => null);
  const audio = form?.get('audio');
  const mode = form?.get('mode');
  if (!(audio instanceof File)) return problem('Send the recording as the "audio" field.', 400);
  if (mode !== 'origin' && mode !== 'feedback') return problem('mode must be "origin" or "feedback".', 400);
  if (audio.size === 0) return problem('The recording is empty.', 400);
  if (audio.size > MAX_BYTES) return problem('The recording is larger than the studio accepts.', 413);

  const extension = audio.type.includes('webm') ? 'webm' : audio.type.includes('mp4') ? 'm4a' : 'webm';
  const thought = form?.get('thought');
  const key = newAudioKey(mode, extension);
  if (!isSafeKey(key)) return problem('Could not name the recording.', 500);

  await env.AUDIO.put(key, audio.stream(), {
    httpMetadata: { contentType: audio.type || 'audio/webm' },
    customMetadata: { mode, by: signedInEmail(request), thought: typeof thought === 'string' ? thought : '' },
  });
  return json({ key }, 201);
};
