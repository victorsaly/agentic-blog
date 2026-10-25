// Why: while Victor talks, the studio shows the words as they are heard, so he can tell he is understood
// before he stops. The browser streams the microphone here as 16 kHz, 16-bit audio over a WebSocket, and
// Workers AI's Nova-3 sends back words as it hears them, on Cloudflare end to end. The live words are only a
// preview: the origin is still the careful transcription of the whole recording, made when he stops
// (transcribe.ts). Behind Cloudflare Access like every studio address.
import { problem, type Handler } from '../_lib';

export const onRequestGet: Handler = async ({ request, env }) => {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
    return problem('Open this address as a WebSocket.', 426);
  return (await env.AI.run(
    '@cf/deepgram/nova-3',
    {
      encoding: 'linear16',
      sample_rate: '16000',
      interim_results: 'true',
      smart_format: 'true',
      language: 'en',
    },
    { websocket: true },
  )) as Response;
};
