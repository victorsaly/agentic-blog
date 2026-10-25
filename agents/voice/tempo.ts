// Why: eleven_v3 is the most expressive voice model but ignores ElevenLabs' speed setting, so a quicker
// reading is made after the fact: ffmpeg's atempo changes the pace and keeps the pitch. It is the agent's
// one local side effect besides writing files; the timings are scaled to match in script.ts, purely.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type Quicken = (audio: Uint8Array, speed: number) => Promise<Uint8Array>;

/** The same speech at `speed` times the pace, as mp3. Needs ffmpeg on the PATH (GitHub's runners have it). */
export const quickenWithFfmpeg: Quicken = async (audio, speed) => {
  const dir = await mkdtemp(join(tmpdir(), 'voice-'));
  try {
    const from = join(dir, 'in.mp3');
    const to = join(dir, 'out.mp3');
    await writeFile(from, audio);
    await run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      from,
      '-filter:a',
      `atempo=${String(speed)}`,
      to,
    ]).catch((error: unknown) => {
      throw new Error(
        `ffmpeg could not change the pace (is it installed?): ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return new Uint8Array(await readFile(to));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
