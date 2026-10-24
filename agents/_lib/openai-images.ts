// Why: OpenAI's image model behind the one model contract, as the project's "images" provider. It follows a
// detailed prompt more closely than the fast Workers AI model, so a card lists it first when its key is set.
// Called over plain HTTP so no SDK is added; the result goes through the same black-on-white step as every
// drawing. Every reply carries the tokens OpenAI reports (the prompt, the reference photo, the picture), so
// the drawing is costed like any other call.
import {
  ModelCallError,
  type ImageReply,
  type ModelAdapter,
  type Provider,
  type Usage,
} from '@roadbook/core';
import { toBlackOnWhite } from './workers-ai.js';

function firstImage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const list = (data as { data?: unknown }).data;
  if (!Array.isArray(list)) return null;
  const first: unknown = list[0];
  if (typeof first !== 'object' || first === null) return null;
  const b64 = (first as { b64_json?: unknown }).b64_json;
  return typeof b64 === 'string' ? b64 : null;
}

/** A token count as OpenAI reports it, or null when it is missing or not a count. */
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

/**
 * The usage OpenAI reports with an image, or null when it reports none or only part of it. A missing
 * counter is never read as zero: that would put a billed drawing into the ledger as free.
 */
export function imageUsage(data: unknown): Usage | null {
  if (typeof data !== 'object' || data === null) return null;
  const usage: unknown = (data as { usage?: unknown }).usage;
  if (typeof usage !== 'object' || usage === null) return null;
  const u = usage as {
    input_tokens?: unknown;
    output_tokens?: unknown;
    input_tokens_details?: unknown;
  };
  const input = count(u.input_tokens);
  const output = count(u.output_tokens);
  if (input === null || output === null) return null;
  // Without the split, every input token is the prompt's: there was no reference photo to count.
  if (u.input_tokens_details === undefined)
    return { inputTokens: input, imageInputTokens: 0, imageOutputTokens: output };
  if (typeof u.input_tokens_details !== 'object' || u.input_tokens_details === null) return null;
  const details = u.input_tokens_details as { text_tokens?: unknown; image_tokens?: unknown };
  const textInput = count(details.text_tokens);
  const imageInput = count(details.image_tokens);
  if (textInput === null || imageInput === null) return null;
  return { inputTokens: textInput, imageInputTokens: imageInput, imageOutputTokens: output };
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

export function openAiImagesAdapter(name: string, provider: Provider): ModelAdapter {
  const secret = provider.secret ?? 'OPENAI_API_KEY';
  // Overridable with OPENAI_IMAGE_MODEL when OpenAI names a newer image model; it then needs a price too.
  const model = process.env['OPENAI_IMAGE_MODEL'] ?? provider.model ?? 'gpt-image-2';

  return {
    provider: name,
    available: () => Boolean(process.env[secret]),
    models: () => [model],
    /**
     * Draws from the prompt alone, or, when a reference photo is given, from the photo and the prompt
     * together (the edits endpoint), so the recurring person keeps the real person's likeness.
     */
    async draw({ prompt, reference }): Promise<ImageReply> {
      const metered = { provider: name, model };
      const key = process.env[secret];
      if (!key) return { ...metered, usage: {}, ok: false, reason: `${secret} is not set.` };
      const text = prompt.slice(0, 4000);
      let response: Response;
      if (reference) {
        const form = new FormData();
        form.set('model', model);
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
          body: JSON.stringify({ model, prompt: text, size: '1024x1024', quality: 'medium', n: 1 }),
        });
      }
      const body = await response.text();
      if (!response.ok)
        return {
          ...metered,
          usage: {},
          ok: false,
          reason: `OpenAI answered ${String(response.status)}: ${errorText(body)}`,
        };
      let data: unknown = null;
      try {
        data = JSON.parse(body);
      } catch {
        data = null;
      }
      const usage = imageUsage(data);
      // A drawing whose cost cannot be read would go into the ledger as free; stop instead.
      if (!usage)
        throw new ModelCallError('OpenAI did not report what the drawing used', {
          ...metered,
          usage: {},
        });
      const image = firstImage(data);
      if (!image) return { ...metered, usage, ok: false, reason: 'OpenAI returned no image.' };
      try {
        return {
          ...metered,
          usage,
          ok: true,
          png: await toBlackOnWhite(Buffer.from(image, 'base64')),
        };
      } catch (error) {
        return {
          ...metered,
          usage,
          ok: false,
          reason: `ffmpeg could not make it black on white: ${String(error)}`,
        };
      }
    },
  };
}
