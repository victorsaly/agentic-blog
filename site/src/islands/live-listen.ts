// Why: the live words need the microphone as Nova-3 hears it: 16 kHz, 16-bit, a tenth of a second at a time,
// over the studio's WebSocket (functions/api/listen.ts). This takes the same stream the recording uses, so
// nothing is asked of the microphone twice, and holds the first words until the connection opens. Paused, it sends nothing but a keep-alive, so the connection
// waits with the recording. A browser that cannot do this (no audio worklets, or a microphone it will not
// resample) gets no live words and says why; the recording itself goes on regardless.
import { heard, noWords, type LiveWords } from '../lib/live-words';

/** Turns each block of microphone samples into a message for the page; inline, so no file is fetched. */
const WORKLET = `
class Samples extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('samples', Samples);
`;

const RATE = 16_000;
/** A tenth of a second of audio per message. */
const BATCH = RATE / 10;
const KEEP_ALIVE_MS = 5_000;
/** The most audio held while the connection opens: ten seconds. */
const HELD = RATE * 10;

export interface LiveListening {
  pause: () => void;
  resume: () => void;
  /** Says the audio has ended, keeps the last words that arrive, then closes. */
  stop: () => void;
}

export function listenLive(
  stream: MediaStream,
  onWords: (words: LiveWords) => void,
  onUnavailable: (why: string) => void,
): LiveListening {
  let words = noWords;
  let paused = false;
  let stopped = false;
  // Read through a function: stop() can be called while the worklet is still loading.
  const ended = (): boolean => stopped;
  let socket: WebSocket | null = null;
  let context: AudioContext | null = null;
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let pending = new Float32Array(0);

  const send = (samples: Float32Array): void => {
    if (paused) return;
    // Until the connection opens, the first words wait here (up to ten seconds), so none are lost.
    const joined = new Float32Array(
      Math.min(pending.length, HELD - samples.length) + samples.length,
    );
    joined.set(pending.subarray(Math.max(0, pending.length - (HELD - samples.length))));
    joined.set(samples, joined.length - samples.length);
    pending = joined;
    if (socket?.readyState !== WebSocket.OPEN || pending.length < BATCH) return;
    const pcm = new Int16Array(pending.length);
    for (let i = 0; i < pending.length; i += 1) {
      const s = Math.max(-1, Math.min(1, pending[i] ?? 0));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    socket.send(pcm.buffer);
    pending = new Float32Array(0);
  };

  void (async () => {
    try {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/api/listen`);
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          words = heard(words, JSON.parse(event.data));
          onWords(words);
        } catch {
          // A message that is not JSON adds no words.
        }
      };
      socket.onerror = () => {
        if (!stopped) onUnavailable('the live words could not connect');
      };
      context = new AudioContext({ sampleRate: RATE });
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await context.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      if (ended()) return;
      const source = context.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(context, 'samples');
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        send(event.data);
      };
      // Joined to the speakers at zero volume, so every browser keeps it running; nothing is heard.
      const silent = context.createGain();
      silent.gain.value = 0;
      source.connect(node).connect(silent).connect(context.destination);
    } catch {
      onUnavailable('this browser cannot stream the microphone for live words');
    }
  })();

  return {
    pause() {
      paused = true;
      keepAlive = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: 'KeepAlive' }));
      }, KEEP_ALIVE_MS);
    },
    resume() {
      paused = false;
      clearInterval(keepAlive);
    },
    stop() {
      stopped = true;
      clearInterval(keepAlive);
      void context?.close();
      const open = socket;
      if (open?.readyState === WebSocket.OPEN) {
        open.send(JSON.stringify({ type: 'CloseStream' }));
        setTimeout(() => {
          open.close();
        }, 3_000);
      } else open?.close();
    },
  };
}
