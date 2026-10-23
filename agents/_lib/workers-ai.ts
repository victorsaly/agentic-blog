// Why: the image agent is the only one that calls Cloudflare instead of Claude. This keeps that call and
// the black-on-white conversion in one place, and says plainly why a picture was not made instead of
// failing the whole run: the prompt is useful on its own.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Fast text-to-image on Workers AI; square 1024px output. */
export const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export type Picture = { ok: true; png: Uint8Array } | { ok: false; reason: string };

function credentials(): { account: string; token: string } | null {
  const account = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const token = process.env['CLOUDFLARE_AI_TOKEN'] ?? process.env['CLOUDFLARE_API_KEY'];
  return account && token ? { account, token } : null;
}

function imageField(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const result = (data as Record<string, unknown>)['result'];
  if (typeof result !== 'object' || result === null) return null;
  const image = (result as Record<string, unknown>)['image'];
  return typeof image === 'string' ? image : null;
}

/** Every pixel to pure black or pure white, so the house style holds whatever the model drew. */
async function toBlackOnWhite(jpeg: Uint8Array): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'agentic-image-'));
  try {
    const input = join(dir, 'in.jpg');
    const output = join(dir, 'out.png');
    await writeFile(input, jpeg);
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

export async function generatePicture(prompt: string): Promise<Picture> {
  const auth = credentials();
  if (!auth)
    return {
      ok: false,
      reason:
        'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN are not both set, so no picture was made.',
    };
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${auth.account}/ai/run/${IMAGE_MODEL}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 8 }),
    },
  );
  if (!response.ok)
    return {
      ok: false,
      reason: `Workers AI answered ${String(response.status)}; the token needs the "Workers AI: Read" permission.`,
    };
  const image = imageField(await response.json());
  if (!image) return { ok: false, reason: 'Workers AI returned no image.' };
  try {
    return { ok: true, png: await toBlackOnWhite(Buffer.from(image, 'base64')) };
  } catch (error) {
    return { ok: false, reason: `ffmpeg could not make it black on white: ${String(error)}` };
  }
}
