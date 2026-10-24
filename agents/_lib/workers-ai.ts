// Why: Workers AI behind the one model contract, as the image agent's fallback drawer, and the black-on-white
// step every drawing goes through whoever drew it. It says plainly why a picture was not made instead of
// failing the whole run: the prompt is useful on its own.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ImageReply, ModelAdapter, Provider } from '@roadbook/core';
import { neuronsPerPicture } from './prices.js';

const run = promisify(execFile);

/** Fast text-to-image on Workers AI; square 1024px output. Used when the provider names no drawModel. */
export const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

/** The account and token; the provider's own secret when it names one, else the usual variables. */
function credentials(secret: string | undefined): { account: string; token: string } | null {
  const account = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const token = secret
    ? process.env[secret]
    : (process.env['CLOUDFLARE_AI_TOKEN'] ?? process.env['CLOUDFLARE_API_KEY']);
  return account && token ? { account, token } : null;
}

/** Cloudflare's own error text, e.g. its content filter refusing a prompt, so the reason is not guessed. */
function errorMessage(body: string): string {
  try {
    const data = JSON.parse(body) as { errors?: { message?: unknown }[] };
    return (data.errors ?? [])
      .map((e) => (typeof e.message === 'string' ? e.message : ''))
      .filter((m) => m !== '')
      .join('; ')
      .slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

function imageField(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const result = (data as Record<string, unknown>)['result'];
  if (typeof result !== 'object' || result === null) return null;
  const image = (result as Record<string, unknown>)['image'];
  return typeof image === 'string' ? image : null;
}

/** Every pixel to pure black or pure white, so the house style holds whatever the model drew. */
export async function toBlackOnWhite(image: Uint8Array): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'agentic-image-'));
  try {
    const input = join(dir, 'in.img');
    const output = join(dir, 'out.png');
    await writeFile(input, image);
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      input,
      '-vf',
      "format=gray,lut=c0='if(gt(val,140),255,0)'",
      '-frames:v',
      '1',
      output,
    ]);
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Workers AI's fast image model behind the one model contract, as a fallback drawer. Cloudflare does not
 * report usage with the picture, so the neurons are counted the way its pricing page counts them for this
 * model at this size and step count (prices.ts, neuronsPerPicture); a refused call is not charged. The
 * provider's `model` is its transcription model; it draws with `drawModel`.
 */
export function workersAiAdapter(name: string, provider: Provider): ModelAdapter {
  const model = provider.drawModel ?? IMAGE_MODEL;
  const secret = provider.secret;
  return {
    provider: name,
    available: () => credentials(secret) !== null,
    models: () => [model],
    async draw({ prompt }): Promise<ImageReply> {
      const metered = { provider: name, model };
      const neurons = neuronsPerPicture[model];
      // A picture whose neurons cannot be counted would go into the ledger as free; it is not drawn.
      if (neurons === undefined)
        return {
          ...metered,
          usage: {},
          ok: false,
          reason: `no neuron count for ${model}; add it to agents/_lib/prices.ts first.`,
        };
      const auth = credentials(secret);
      if (!auth)
        return {
          ...metered,
          usage: {},
          ok: false,
          reason: `CLOUDFLARE_ACCOUNT_ID and ${secret ?? 'CLOUDFLARE_AI_TOKEN'} are not both set, so no picture was made.`,
        };
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${auth.account}/ai/run/${model}`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 8 }),
        },
      );
      if (!response.ok) {
        const detail = await response.text().then(errorMessage, () => '');
        const hint =
          response.status === 401 || response.status === 403
            ? ' The token needs the "Workers AI: Read" permission.'
            : '';
        return {
          ...metered,
          usage: {},
          ok: false,
          reason: `Workers AI answered ${String(response.status)}${detail ? `: ${detail}` : ''}.${hint}`,
        };
      }
      // The call succeeded, so it was charged: from here every reply carries what it used.
      const usage = { neurons };
      let data: unknown;
      try {
        data = await response.json();
      } catch (error) {
        return {
          ...metered,
          usage,
          ok: false,
          reason: `Workers AI's answer could not be read: ${String(error)}`,
        };
      }
      const image = imageField(data);
      if (!image) return { ...metered, usage, ok: false, reason: 'Workers AI returned no image.' };
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
