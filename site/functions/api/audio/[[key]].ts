// Why: the origin page has a play button, so the recording must be served. It is read-only, cached, and
// only for keys that look like ours. Access is already in front of /api/* (the middleware), so audio is
// private until the day the origin pages are meant to be public; then this route moves out from under /api.
import { isSafeKey, problem, type Handler } from '../../_lib';

export const onRequestGet: Handler = async ({ params, env }) => {
  const raw = params['key'];
  const key = Array.isArray(raw) ? raw.join('/') : String(raw ?? '');
  if (!isSafeKey(key)) return problem('Not a recording.', 404);

  const object = await env.AUDIO.get(key);
  if (!object) return problem('No recording with that key.', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');
  return new Response(object.body, { headers });
};
