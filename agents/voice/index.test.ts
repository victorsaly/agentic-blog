// Why: the voice agent spends real money and publishes audio a person will hear, so what it speaks, when it
// refuses, and when it stays quiet are pinned here with a stand-in voice: no test ever calls ElevenLabs.
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import type { AgentContext, Settings } from '../_lib/types.js';
import type { Speech } from './elevenlabs.js';
import { AUDIO, MANIFEST, MAX_SPOKEN_WORDS, SOURCE, TIMINGS, makeRun, voiceFor } from './index.js';
import { fingerprint, spokenText } from './script.js';

const settings = {
  site: { domain: 'blog.victorsaly.com' },
  languages: { origin: 'en', publish: ['en'] },
  media: { voice_id: null },
} as unknown as Settings;

const shortVersion = (body: string): string => `---\nwhy: A short version.\n---\n\n${body}\n`;

function context(files: Record<string, string>): AgentContext {
  return {
    agent: 'voice',
    prompt: {
      meta: { name: 'voice', why: 'x'.repeat(20), phase: 5, reads: ['a'], writes: ['b'] },
      instructions: '',
    },
    settings,
    profile: '',
    thought: { slug: 'a-thought', dir: '/nowhere', files: new Map(Object.entries(files)) },
    ask: () => Promise.reject(new Error('the voice agent asks no model')),
    today: '2026-10-24',
  };
}

/** A voice that says every character in a tenth of a second and records the text it was given. */
function fakeVoice(): { calls: string[]; synthesise: (text: string) => Promise<Speech> } {
  const calls: string[] = [];
  return {
    calls,
    synthesise: (text) => {
      calls.push(text);
      const characters = Array.from(text);
      return Promise.resolve({
        audio: new Uint8Array([1, 2, 3]),
        clock: {
          characters,
          characterStartTimesSeconds: characters.map((_, i) => i / 10),
          characterEndTimesSeconds: characters.map((_, i) => (i + 1) / 10),
        },
      });
    },
  };
}

const everythingThere = () => Promise.resolve(true);
const nothingThere = () => Promise.resolve(false);

describe('voice agent', () => {
  it('reads the short version as written and writes audio, timings and a manifest', async () => {
    const voice = fakeVoice();
    const run = makeRun({ synthesise: voice.synthesise, exists: nothingThere });
    const result = await run(context({ [SOURCE]: shortVersion('# Idea\n\nOne **two** three.') }));

    expect(result.status).toBe('done');
    expect(voice.calls).toEqual(['Idea\n\nOne two three.']);
    expect(result.files.map((f) => f.path)).toEqual([AUDIO, TIMINGS, MANIFEST]);
    expect(result.files[0]?.bytes).toEqual(new Uint8Array([1, 2, 3]));

    const timings: unknown = JSON.parse(new TextDecoder().decode(result.files[1]?.bytes));
    expect(timings).toEqual({
      words: [
        ['Idea', 0, 0.4],
        ['One', 0.6, 0.9],
        ['two', 1, 1.3],
        ['three.', 1.4, 2],
      ],
    });

    const manifest = matter(result.files[2]?.content ?? '');
    expect(manifest.data).toMatchObject({
      generated_by: 'voice',
      read_from: SOURCE,
      model: 'eleven_v3',
      words: 4,
      reviewed: false,
    });
    expect(manifest.content.trim()).toBe('Idea\n\nOne two three.');
  });

  it('stays quiet and spends nothing when the text has not changed and the audio is there', async () => {
    const source = shortVersion('Same words.');
    const hash = fingerprint(spokenText(source, 'blog.victorsaly.com'));
    const voice = fakeVoice();
    const run = makeRun({ synthesise: voice.synthesise, exists: everythingThere });
    const result = await run(
      context({
        [SOURCE]: source,
        [MANIFEST]: `---\nwhy: Read aloud once.\ntext_sha256: ${hash}\n---\n\nSame words.\n`,
      }),
    );
    expect(result.status).toBe('nothing-to-do');
    expect(voice.calls).toEqual([]);
  });

  it('reads again when the text changed, or when the audio is gone', async () => {
    const source = shortVersion('New words.');
    const manifest = `---\nwhy: Read aloud once.\ntext_sha256: ${fingerprint('Old words.')}\n---\n`;
    const changed = fakeVoice();
    await makeRun({ synthesise: changed.synthesise, exists: everythingThere })(
      context({ [SOURCE]: source, [MANIFEST]: manifest }),
    );
    expect(changed.calls).toHaveLength(1);

    const hash = fingerprint('New words.');
    const missing = fakeVoice();
    await makeRun({ synthesise: missing.synthesise, exists: nothingThere })(
      context({
        [SOURCE]: source,
        [MANIFEST]: `---\nwhy: Read aloud once.\ntext_sha256: ${hash}\n---\n`,
      }),
    );
    expect(missing.calls).toHaveLength(1);
  });

  it('holds a text that is too long to be an idea, without spending', async () => {
    const voice = fakeVoice();
    const run = makeRun({ synthesise: voice.synthesise, exists: nothingThere });
    const result = await run(
      context({ [SOURCE]: shortVersion('word '.repeat(MAX_SPOKEN_WORDS + 1)) }),
    );
    expect(result.status).toBe('held');
    expect(result.holdReason).toContain(String(MAX_SPOKEN_WORDS));
    expect(result.files).toEqual([]);
    expect(voice.calls).toEqual([]);
  });

  it('has nothing to do when the short version has nothing to say', async () => {
    const run = makeRun({ synthesise: fakeVoice().synthesise, exists: nothingThere });
    const result = await run(context({ [SOURCE]: shortVersion('blog.victorsaly.com') }));
    expect(result.status).toBe('nothing-to-do');
  });

  it('writes nothing when the voice said different words from the text', async () => {
    const run = makeRun({
      synthesise: () =>
        Promise.resolve({
          audio: new Uint8Array([1]),
          clock: {
            characters: Array.from('Other words'),
            characterStartTimesSeconds: Array.from('Other words').map((_, i) => i),
            characterEndTimesSeconds: Array.from('Other words').map((_, i) => i + 1),
          },
        }),
      exists: nothingThere,
    });
    await expect(run(context({ [SOURCE]: shortVersion('Intended words.') }))).rejects.toThrow(
      /nothing was written/,
    );
  });

  it('needs the short version', async () => {
    const run = makeRun({ synthesise: fakeVoice().synthesise, exists: nothingThere });
    await expect(run(context({}))).rejects.toThrow(/versions\/short\.md is missing/);
  });
});

describe('voiceFor', () => {
  it('is Chris W unless the settings choose another voice', () => {
    expect(voiceFor(settings).name).toBe('Chris W');
    const other = { ...settings, media: { ...settings.media, voice_id: 'abc123' } };
    expect(voiceFor(other).id).toBe('abc123');
  });
});
