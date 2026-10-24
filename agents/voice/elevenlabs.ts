// Why: the one place the voice agent leaves the machine. The text goes to ElevenLabs and comes back as
// speech plus a clock for every character. Kept apart from the rest so a test can stand in for it and no
// test ever spends credits. The key is read from the environment here and nowhere else.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { CharacterClock } from './script.js';

export interface Speech {
  audio: Uint8Array;
  clock: CharacterClock;
}

export interface Voice {
  id: string;
  name: string;
  model: string;
}

/** The voice the tour and the pitch already use, so the blog sounds like the rest of the project. */
export const defaultVoice: Voice = {
  id: 'hoSRtERLhFa8UfJ6P1JP',
  name: 'Chris W',
  model: 'eleven_v3',
};

export type Synthesise = (text: string, voice: Voice) => Promise<Speech>;

export const synthesise: Synthesise = async (text, voice) => {
  const apiKey = process.env['ELEVENLABS_API_KEY'];
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
  const client = new ElevenLabsClient({ apiKey });
  const response = await client.textToSpeech.convertWithTimestamps(voice.id, {
    text,
    modelId: voice.model,
  });
  const clock = response.alignment;
  if (!clock) throw new Error('the voice service sent no timing, so the audio cannot be synced');
  return { audio: new Uint8Array(Buffer.from(response.audioBase64, 'base64')), clock };
};
