// Why: the voice the blog speaks in, and the shape of speech the voice agent works with. The call to
// ElevenLabs itself is the "voices" adapter (agents/_lib/elevenlabs.ts), reached through ctx.speak, so every
// reading is metered and costed in the ledger; a test stands in with its own Synthesise and spends nothing.
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
