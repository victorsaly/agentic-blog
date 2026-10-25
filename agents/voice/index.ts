// Why: see PROMPT.md. The idea-depth version, read aloud: audio the reader can play and a clock for every
// word so the page can light the word being spoken. No model reasons here; the text is whatever the human
// approved in versions/short.md, spoken as written. A text that has not changed since the last run is not
// spoken again, and a text that is too long to be an "idea" is held rather than paid for.
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { markdownFile } from '../_lib/files.js';
import { readIfPresent, readOrThrow, verdictProblem } from '../_lib/generic.js';
import type { AgentContext, AgentRun, OutputFile, Settings } from '../_lib/types.js';
import { defaultVoice, type Synthesise, type Voice } from './elevenlabs.js';
import {
  clockMatches,
  durationOf,
  fingerprint,
  quickenClock,
  spokenText,
  wordCount,
  wordsFromClock,
} from './script.js';
import { quickenWithFfmpeg, type Quicken } from './tempo.js';

export const SOURCE = 'versions/short.md';
export const MANIFEST = 'voice/short.md';
export const AUDIO = 'voice/short.mp3';
export const TIMINGS = 'voice/short.json';

/** The idea is one screen; a text past this is not an idea any more, and speaking it costs real money. */
export const MAX_SPOKEN_WORDS = 400;

export function voiceFor(settings: Settings): Voice {
  const id = settings.media.voice_id;
  return id === null || id === defaultVoice.id
    ? defaultVoice
    : {
        id,
        name: settings.media.voice_name ?? `${settings.site.author}’s voice`,
        model: defaultVoice.model,
      };
}

/** How much quicker than the voice's own pace the reading is played; 1 leaves it as spoken. */
export function speedFor(settings: Settings): number {
  return settings.media.voice_speed ?? 1;
}

/** One word per line, so a changed word is one changed line in the pull request. */
export function timingsFile(words: readonly (readonly [string, number, number])[]): Uint8Array {
  const lines = words.map((w) => `    ${JSON.stringify(w)}`).join(',\n');
  return new TextEncoder().encode(`{\n  "words": [\n${lines}\n  ]\n}\n`);
}

/** What the last reading was made from: its text and its voice (a manifest without one predates the setting). */
function previousReading(ctx: AgentContext): {
  hash: string | null;
  voiceId: string;
  speed: number;
} {
  const manifest = readIfPresent(ctx, MANIFEST);
  const data = manifest === undefined ? {} : matter(manifest).data;
  const hash: unknown = data['text_sha256'];
  const voiceId: unknown = data['voice_id'];
  const speed: unknown = data['speed'];
  return {
    hash: typeof hash === 'string' ? hash : null,
    voiceId: typeof voiceId === 'string' ? voiceId : defaultVoice.id,
    speed: typeof speed === 'number' ? speed : 1,
  };
}

const onDisk = (dir: string) => (path: string) =>
  access(join(dir, path)).then(
    () => true,
    () => false,
  );

export interface VoiceDeps {
  /** Tests stand in for the voice service here; a real run speaks through ctx.speak, which is metered. */
  synthesise?: Synthesise;
  /** Whether a file already exists in the thought folder (the mp3 and timings are not Markdown, so not in ctx). */
  exists: (ctx: AgentContext, path: string) => Promise<boolean>;
  /** Plays the audio quicker when the settings ask for it; tests stand in so nothing runs ffmpeg. */
  quicken?: Quicken;
}

export function makeRun(deps: VoiceDeps): AgentRun {
  return async (ctx) => {
    const unguarded = [verdictProblem(ctx, 'safety.md'), verdictProblem(ctx, 'security.md')].filter(
      (p): p is string => p !== null,
    );
    if (unguarded.length > 0)
      return {
        status: 'held',
        summary: 'Not read aloud: the guards have not passed this thought; no audio was made.',
        holdReason: unguarded.join('\n'),
        files: [],
      };

    const text = spokenText(readOrThrow(ctx, SOURCE), ctx.settings.site.domain);
    const words = wordCount(text);
    if (words === 0)
      return { status: 'nothing-to-do', summary: `${SOURCE} has nothing to read.`, files: [] };
    if (words > MAX_SPOKEN_WORDS)
      return {
        status: 'held',
        summary: `${SOURCE} is ${String(words)} words; no audio was made.`,
        holdReason: `The short version is ${String(words)} words and the voice agent reads at most ${String(MAX_SPOKEN_WORDS)}. Shorten it, or raise maxSpokenWords on the voice card, then run again.`,
        files: [],
      };

    const hash = fingerprint(text);
    const voice = voiceFor(ctx.settings);
    const speed = speedFor(ctx.settings);
    const previous = previousReading(ctx);
    if (
      previous.hash === hash &&
      previous.voiceId === voice.id &&
      previous.speed === speed &&
      (await deps.exists(ctx, AUDIO)) &&
      (await deps.exists(ctx, TIMINGS))
    )
      return {
        status: 'nothing-to-do',
        summary:
          'Neither the short version nor the voice nor its pace has changed since it was last read; the audio stands.',
        files: [],
      };

    const spoken = deps.synthesise
      ? await deps.synthesise(text, voice)
      : await ctx.speak(text, { id: voice.id, model: voice.model });
    const speech =
      speed === 1
        ? spoken
        : {
            audio: await (deps.quicken ?? quickenWithFfmpeg)(spoken.audio, speed),
            clock: quickenClock(spoken.clock, speed),
          };
    const timed = wordsFromClock(speech.clock);
    if (!clockMatches(text, timed))
      throw new Error(
        'the voice service’s words are not the text’s words, so the page could not light them in step; nothing was written',
      );
    const seconds = durationOf(timed);

    const files: OutputFile[] = [
      { path: AUDIO, content: '', bytes: speech.audio },
      { path: TIMINGS, content: '', bytes: timingsFile(timed) },
      {
        path: MANIFEST,
        content: markdownFile(
          {
            why: 'The short version, read aloud in one voice, with the time of every word, so a reader who would rather listen can, and the page can follow along. The text below is exactly what is spoken.',
            generated_by: 'voice',
            read_from: SOURCE,
            language: ctx.settings.languages.origin,
            audio: 'short.mp3',
            timings: 'short.json',
            voice: voice.name,
            voice_id: voice.id,
            model: voice.model,
            ...(speed === 1 ? {} : { speed }),
            text_sha256: hash,
            words: timed.length,
            seconds,
            made: ctx.today,
            reviewed: false,
          },
          text,
        ),
      },
    ];
    return {
      status: 'done',
      summary: `Read the short version aloud in ${voice.name} (${voice.model}${speed === 1 ? '' : `, ${String(speed)}× pace`}): ${String(timed.length)} words, ${seconds.toFixed(1)} seconds, a time for every word. Listen to it before merging; the audio and the text are approved together.`,
      files,
    };
  };
}

export const run: AgentRun = makeRun({
  exists: (ctx, path) => onDisk(ctx.thought.dir)(path),
});
