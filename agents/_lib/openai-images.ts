// Why: the fast Workers AI model gets the gist and fumbles heads, hands and objects. OpenAI's image model
// follows a detailed prompt more closely, so it is the first choice when its key is set. Called over plain
// HTTP so no SDK is added; the result goes through the same black-on-white step as every drawing.
import type { Picture } from './workers-ai.js';
import { toBlackOnWhite } from './workers-ai.js';

/** Overridable with OPENAI_IMAGE_MODEL when OpenAI names a newer image model. */
export const OPENAI_IMAGE_MODEL = process.env['OPENAI_IMAGE_MODEL'] ?? 'gpt-image-2';

export function openAiAvailable(): boolean {
  return Boolean(process.env['OPENAI_API_KEY']);
}

function firstImage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const list = (data as { data?: unknown }).data;
  if (!Array.isArray(list)) return null;
  const first: unknown = list[0];
  if (typeof first !== 'object' || first === null) return null;
  const b64 = (first as { b64_json?: unknown }).b64_json;
  return typeof b64 === 'string' ? b64 : null;
}

function errorText(body: string): string {
  try {
    const data = JSON.parse(body) as { error?: { message?: unknown } };
    return typeof data.error?.message === 'string'
      ? data.error.message.slice(0, 200)
      : body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

/**
 * Draws from the prompt alone, or, when a reference photo is given, from the photo and the prompt
 * together (the edits endpoint), so the recurring person keeps the real person's likeness.
 */
export async function generateWithOpenAi(prompt: string, reference?: Uint8Array): Promise<Picture> {
  const key = process.env['OPENAI_API_KEY'];
  if (!key) return { ok: false, reason: 'OPENAI_API_KEY is not set.' };
  const text = prompt.slice(0, 4000);
  let response: Response;
  if (reference) {
    const form = new FormData();
    form.set('model', OPENAI_IMAGE_MODEL);
    form.set(
      'prompt',
      `${text} The person in the drawing is the person in the reference photo: keep his face and build recognisable, translated into the style above.`,
    );
    form.set('size', '1024x1024');
    form.set('quality', 'medium');
    form.append('image[]', new Blob([reference], { type: 'image/png' }), 'reference.png');
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: text,
        size: '1024x1024',
        quality: 'medium',
        n: 1,
      }),
    });
  }
  const body = await response.text();
  if (!response.ok)
    return { ok: false, reason: `OpenAI answered ${String(response.status)}: ${errorText(body)}` };
  let image: string | null = null;
  try {
    image = firstImage(JSON.parse(body));
  } catch {
    image = null;
  }
  if (!image) return { ok: false, reason: 'OpenAI returned no image.' };
  try {
    return { ok: true, png: await toBlackOnWhite(Buffer.from(image, 'base64')) };
  } catch (error) {
    return { ok: false, reason: `ffmpeg could not make it black on white: ${String(error)}` };
  }
}
