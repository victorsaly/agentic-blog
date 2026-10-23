// Why: the studio is a private page with one job: let Victor talk and turn that into an origin. This island
// records in the browser, sends the audio to R2, asks for a transcript, and opens the pull request. It is
// React because the state (idle, recording, uploading, transcribed, sent) drives everything on screen.
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase =
  | { kind: 'idle' }
  | { kind: 'recording'; since: number }
  | { kind: 'uploading' }
  | { kind: 'transcribing'; key: string }
  | { kind: 'ready'; key: string; transcript: string }
  | { kind: 'sending'; key: string; transcript: string }
  | { kind: 'sent'; prUrl: string }
  | { kind: 'failed'; message: string; retry?: () => void };

interface UploadResponse {
  key: string;
}

interface TranscribeResponse {
  text: string;
}

interface OriginResponse {
  prUrl: string;
}

export interface RecorderProps {
  /** 'origin' records a thought; 'feedback' records a note about an output and needs the thought slug. */
  mode: 'origin' | 'feedback';
  thoughtSlug?: string;
}

async function postJson<T>(url: string, body: BodyInit, contentType?: string): Promise<T> {
  const headers: Record<string, string> = contentType ? { 'content-type': contentType } : {};
  const response = await fetch(url, { method: 'POST', body, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${url} answered ${String(response.status)}: ${text || response.statusText}`);
  }
  return (await response.json()) as T;
}

function formatElapsed(since: number, now: number): string {
  const total = Math.floor((now - since) / 1000);
  const minutes = String(Math.floor(total / 60));
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function Recorder({ mode, thoughtSlug }: RecorderProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [now, setNow] = useState<number>(() => Date.now());
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (phase.kind !== 'recording') return undefined;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [phase.kind]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.start(1000);
      recorder.current = media;
      setNow(Date.now());
      setPhase({ kind: 'recording', since: Date.now() });
    } catch (error) {
      setPhase({ kind: 'failed', message: `The microphone did not open: ${String(error)}` });
    }
  }, []);

  const upload = useCallback(
    async (blob: Blob) => {
      setPhase({ kind: 'uploading' });
      try {
        const form = new FormData();
        form.set('audio', blob, `${mode}-${new Date().toISOString()}.webm`);
        form.set('mode', mode);
        if (thoughtSlug) form.set('thought', thoughtSlug);
        const { key } = await postJson<UploadResponse>('/api/upload', form);
        setPhase({ kind: 'transcribing', key });
        const { text } = await postJson<TranscribeResponse>('/api/transcribe', JSON.stringify({ key }), 'application/json');
        setPhase({ kind: 'ready', key, transcript: text });
      } catch (error) {
        setPhase({ kind: 'failed', message: String(error), retry: () => void upload(blob) });
      }
    },
    [mode, thoughtSlug],
  );

  const stop = useCallback(() => {
    const media = recorder.current;
    if (!media) return;
    media.onstop = () => {
      media.stream.getTracks().forEach((track) => {
        track.stop();
      });
      void upload(new Blob(chunks.current, { type: media.mimeType }));
    };
    media.stop();
    recorder.current = null;
  }, [upload]);

  const send = useCallback(async () => {
    if (phase.kind !== 'ready') return;
    const { key, transcript } = phase;
    setPhase({ kind: 'sending', key, transcript });
    try {
      const body = JSON.stringify({ key, transcript, mode, thought: thoughtSlug ?? null });
      const { prUrl } = await postJson<OriginResponse>('/api/origin', body, 'application/json');
      setPhase({ kind: 'sent', prUrl });
    } catch (error) {
      setPhase({ kind: 'failed', message: String(error), retry: () => void send() });
    }
  }, [mode, phase, thoughtSlug]);

  const title = mode === 'origin' ? 'Say it' : 'Say what is wrong with the output';

  return (
    <section className="recorder" aria-live="polite">
      {phase.kind === 'idle' && (
        <button type="button" className="big" onClick={() => void start()}>
          {title}
        </button>
      )}

      {phase.kind === 'recording' && (
        <>
          <p className="elapsed" aria-label="Recording time">
            {formatElapsed(phase.since, now)}
          </p>
          <button type="button" className="big" onClick={stop}>
            Stop
          </button>
        </>
      )}

      {phase.kind === 'uploading' && <p>Saving the recording…</p>}
      {phase.kind === 'transcribing' && <p>Writing down what you said…</p>}

      {(phase.kind === 'ready' || phase.kind === 'sending') && (
        <>
          <p className="small quiet">This is the first conversion. It is not edited here; the pull request keeps it as it is.</p>
          <blockquote className="transcript">{phase.transcript}</blockquote>
          <div className="row">
            <button type="button" onClick={() => void send()} disabled={phase.kind === 'sending'}>
              {phase.kind === 'sending' ? 'Opening the pull request…' : mode === 'origin' ? 'Make it an origin' : 'Send the feedback'}
            </button>
            <button type="button" onClick={() => setPhase({ kind: 'idle' })} disabled={phase.kind === 'sending'}>
              Discard
            </button>
          </div>
        </>
      )}

      {phase.kind === 'sent' && (
        <p>
          Done. <a href={phase.prUrl}>The pull request is open</a>; read it, fix what sounds wrong, merge.{' '}
          <button type="button" onClick={() => setPhase({ kind: 'idle' })}>
            Say another
          </button>
        </p>
      )}

      {phase.kind === 'failed' && (
        <p role="alert">
          {phase.message}{' '}
          {phase.retry && (
            <button type="button" onClick={phase.retry}>
              Try again
            </button>
          )}{' '}
          <button type="button" onClick={() => setPhase({ kind: 'idle' })}>
            Start over
          </button>
        </p>
      )}
    </section>
  );
}
