// Why: ElevenLabs behind the one model contract, as the project's "voices" provider. It sends the text and
// brings back the speech with the time of every character, and says how many characters were billed: the
// count ElevenLabs reports with the response, or, when it reports none, the characters sent, which is what
// it bills by. So the voice agent's runs are costed like every other call.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ModelCallError, type ModelAdapter, type Provider, type SpeechReply } from '@roadbook/core';

/** The billed character count from a response's headers, when ElevenLabs sends one. */
export function billedCharacters(headers: Headers, sent: string): number {
  for (const name of ['character-cost', 'x-character-count']) {
    const value = Number(headers.get(name));
    if (headers.has(name) && Number.isFinite(value) && value >= 0) return value;
  }
  // Counted in UTF-16 units: an emoji counts as two, so if anything this records a little more, never less.
  return sent.length;
}

export function elevenLabsAdapter(name: string, provider: Provider): ModelAdapter {
  const secret = provider.secret ?? 'ELEVENLABS_API_KEY';
  const fallbackModel = provider.model ?? 'eleven_v3';

  return {
    provider: name,
    available: () => Boolean(process.env[secret]),
    models: () => [fallbackModel],
    async speak({ text, voice, model: asked }): Promise<SpeechReply> {
      const apiKey = process.env[secret];
      if (!apiKey) throw new Error(`${secret} is not set`);
      const model = asked ?? fallbackModel;
      const client = new ElevenLabsClient({ apiKey });
      const { data, rawResponse } = await client.textToSpeech
        .convertWithTimestamps(voice, { text, modelId: model })
        .withRawResponse();
      const usage = { characters: billedCharacters(rawResponse.headers, text) };
      const clock = data.alignment;
      // The speech was made and billed even if its clock is missing, so the error carries what it used.
      if (!clock)
        throw new ModelCallError(
          'the voice service sent no timing, so the audio cannot be synced',
          {
            provider: name,
            model,
            usage,
          },
        );
      return {
        provider: name,
        model,
        usage,
        audio: new Uint8Array(Buffer.from(data.audioBase64, 'base64')),
        clock,
      };
    },
  };
}
