// Why: the pitch's voice and music are made once and kept in scripts/pitch/audio/ (local, not committed), so
// the video can be re-cut without paying for them again. A clip that is already there is never made again: delete it to
// remake it (after changing its line in scenes.ts). The key is read from site/.env.local, never written here.
// Usage: npm run pitch:voice
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { music, scenes, voice } from './scenes.js';

const audio = new URL('./audio/', import.meta.url).pathname;

async function save(stream: ReadableStream<Uint8Array>, file: string): Promise<void> {
  await pipeline(Readable.fromWeb(stream), createWriteStream(file));
}

async function main(): Promise<void> {
  if (!process.env['ELEVENLABS_API_KEY']) {
    console.error(
      'No ELEVENLABS_API_KEY: run with --env-file=site/.env.local (npm run pitch:voice does).',
    );
    process.exit(1);
  }
  const client = new ElevenLabsClient();
  await mkdir(audio, { recursive: true });

  for (const s of scenes) {
    if (!s.vo) continue;
    const file = `${audio}vo-${s.vo.key}.mp3`;
    if (existsSync(file)) {
      console.info(`kept  vo-${s.vo.key}.mp3`);
      continue;
    }
    console.info(`voice vo-${s.vo.key}.mp3: ${s.vo.line}`);
    await save(
      await client.textToSpeech.convert(voice.id, { text: s.vo.line, modelId: voice.model }),
      file,
    );
  }

  const bed = `${audio}music.mp3`;
  if (existsSync(bed)) {
    console.info('kept  music.mp3');
  } else {
    console.info('music music.mp3 (about a minute)');
    await save(
      await client.music.compose({
        prompt: music.prompt,
        musicLengthMs: 60_000,
        modelId: music.model,
        forceInstrumental: true,
      }),
      bed,
    );
  }
}

await main();
