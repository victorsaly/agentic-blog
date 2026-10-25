// Why: the tour on /how-it-works is read in the blogger's own voice, the one that reads the posts, and the word
// being said is underlined as it is on a post. So each station's line is spoken exactly as the voice agent
// speaks a post: the voice and pace from settings.yml, ElevenLabs with the time of every character, the
// same quickening, and the same check that the words heard are the words on screen. The clips go to
// site/public/tour/<id>.mp3 and every word's time to site/src/lib/tour-words.json. It spends credits, so it
// makes only the stations named, or all of them when none is. The key is read from site/.env.local.
// Usage: npm run tour:voice [-- <station id> ...]
import { readFile, writeFile } from 'node:fs/promises';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { parse } from 'yaml';
import { speedFor, voiceFor } from '../agents/voice/index.js';
import {
  clockMatches,
  quickenClock,
  wordsFromClock,
  type TimedWord,
} from '../agents/voice/script.js';
import { quickenWithFfmpeg } from '../agents/voice/tempo.js';
import type { Settings } from '../agents/_lib/types.js';
import { tour } from '../site/src/lib/tour.js';

const root = new URL('../', import.meta.url).pathname;
const wordsFile = `${root}site/src/lib/tour-words.json`;

async function main(): Promise<void> {
  if (!process.env['ELEVENLABS_API_KEY']) {
    console.error(
      'No ELEVENLABS_API_KEY: run with --env-file=site/.env.local (npm run tour:voice does).',
    );
    process.exit(1);
  }
  const settings = parse(await readFile(`${root}settings.yml`, 'utf8')) as Settings;
  const voice = voiceFor(settings);
  const speed = speedFor(settings);
  const asked = process.argv.slice(2);
  const stations = asked.length > 0 ? tour.filter((s) => asked.includes(s.id)) : tour;
  if (stations.length === 0) throw new Error(`no station called ${asked.join(', ')}`);

  const known = JSON.parse(await readFile(wordsFile, 'utf8').catch(() => '{}')) as Record<
    string,
    TimedWord[]
  >;
  const client = new ElevenLabsClient();
  for (const s of stations) {
    const data = await client.textToSpeech.convertWithTimestamps(voice.id, {
      text: s.line,
      modelId: voice.model,
    });
    if (!data.alignment) throw new Error(`${s.id}: the voice service sent no timing`);
    const spoken = new Uint8Array(Buffer.from(data.audioBase64, 'base64'));
    const audio = speed === 1 ? spoken : await quickenWithFfmpeg(spoken, speed);
    const clock = speed === 1 ? data.alignment : quickenClock(data.alignment, speed);
    const words = wordsFromClock(clock);
    if (!clockMatches(s.line, words))
      throw new Error(`${s.id}: the words spoken are not the words on screen; nothing saved`);
    await writeFile(`${root}site/public/tour/${s.id}.mp3`, audio);
    known[s.id] = words;
    const seconds = words[words.length - 1]?.[2] ?? 0;
    console.info(`made  ${s.id}.mp3  ${String(words.length)} words, ${seconds.toFixed(1)} s`);
  }
  const ordered = Object.fromEntries(
    tour.flatMap((s) => (known[s.id] ? [[s.id, known[s.id]]] : [])),
  );
  await writeFile(wordsFile, `${JSON.stringify(ordered)}\n`);
  console.info(
    `${voice.name} (${voice.model}, ${String(speed)}× pace) → site/src/lib/tour-words.json`,
  );
}

await main();
