// Why: the studio is a private page with one job: let Victor talk and turn that into an origin. This island
// records in the browser, sends the audio to R2, asks for a transcript, and opens the pull request. Some
// thoughts already exist as text (written down, or transcribed elsewhere), so the same island also takes
// words typed or pasted in, with no recording. It is React because the state drives everything on screen.
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Phase =
  | { kind: 'idle' }
  | { kind: 'recording'; since: number }
  | { kind: 'uploading' }
  | { kind: 'transcribing'; key: string }
  | { kind: 'ready'; key: string; transcript: string }
  | { kind: 'sending'; key: string; transcript: string }
  | { kind: 'writing'; text: string; sending: boolean }
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
  const data: unknown = await response.json();
  return data as T;
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
  const textArea = useRef<HTMLTextAreaElement | null>(null);
  const textId = useId();
  const writing = phase.kind === 'writing';

  // The reader asked for the text box by pressing the button, so the caret goes straight into it.
  useEffect(() => {
    if (writing) textArea.current?.focus();
  }, [writing]);

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
        const { text } = await postJson<TranscribeResponse>(
          '/api/transcribe',
          JSON.stringify({ key }),
          'application/json',
        );
        setPhase({ kind: 'ready', key, transcript: text });
      } catch (error) {
        setPhase({
          kind: 'failed',
          message: String(error),
          retry: () => {
            void upload(blob);
          },
        });
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
      setPhase({
        kind: 'failed',
        message: String(error),
        retry: () => {
          void send();
        },
      });
    }
  }, [mode, phase, thoughtSlug]);

  const sendText = useCallback(
    async (text: string) => {
      setPhase({ kind: 'writing', text, sending: true });
      try {
        const body = JSON.stringify({
          medium: 'text',
          transcript: text,
          mode,
          thought: thoughtSlug ?? null,
        });
        const { prUrl } = await postJson<OriginResponse>('/api/origin', body, 'application/json');
        setPhase({ kind: 'sent', prUrl });
      } catch (error) {
        setPhase({
          kind: 'failed',
          message: String(error),
          retry: () => {
            void sendText(text);
          },
        });
      }
    },
    [mode, thoughtSlug],
  );

  const title = mode === 'origin' ? 'Say it' : 'Say what is wrong with the output';
  const writeLabel = mode === 'origin' ? 'Write or paste it instead' : 'Write it instead';
  const sendLabel = mode === 'origin' ? 'Make it an origin' : 'Send the feedback';

  return (
    <section className="recorder" aria-live="polite">
      {phase.kind === 'idle' && (
        <>
          <button
            type="button"
            className="big"
            onClick={() => {
              void start();
            }}
          >
            {title}
          </button>
          <button
            type="button"
            className="alternative"
            onClick={() => {
              setPhase({ kind: 'writing', text: '', sending: false });
            }}
          >
            {writeLabel}
          </button>
        </>
      )}

      {phase.kind === 'writing' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (phase.text.trim().length > 0) void sendText(phase.text);
          }}
        >
          <label htmlFor={textId} className="field">
            {mode === 'origin' ? 'The words, as they are' : 'What is wrong with the output'}
            <textarea
              id={textId}
              ref={textArea}
              rows={10}
              value={phase.text}
              readOnly={phase.sending}
              aria-describedby={`${textId}-hint`}
              onChange={(event) => {
                setPhase({ kind: 'writing', text: event.target.value, sending: false });
              }}
            />
          </label>
          <p id={`${textId}-hint`} className="small quiet">
            {mode === 'origin'
              ? 'Write it here, or paste a transcript from somewhere else. It is kept exactly as it is, typos and all, and marked as text rather than a recording.'
              : 'Say what went down the wrong road, not which sentences to change.'}
          </p>
          <div className="row">
            <button type="submit" disabled={phase.sending || phase.text.trim().length === 0}>
              {phase.sending ? 'Opening the pull request…' : sendLabel}
            </button>
            <button
              type="button"
              disabled={phase.sending}
              onClick={() => {
                setPhase({ kind: 'idle' });
              }}
            >
              Discard
            </button>
          </div>
        </form>
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
          <p className="small quiet">
            This is the first conversion. It is not edited here; the pull request keeps it as it is.
          </p>
          <blockquote className="transcript">{phase.transcript}</blockquote>
          <div className="row">
            <button
              type="button"
              onClick={() => {
                void send();
              }}
              disabled={phase.kind === 'sending'}
            >
              {phase.kind === 'sending' ? 'Opening the pull request…' : sendLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase({ kind: 'idle' });
              }}
              disabled={phase.kind === 'sending'}
            >
              Discard
            </button>
          </div>
        </>
      )}

      {phase.kind === 'sent' && (
        <p>
          Done. <a href={phase.prUrl}>The pull request is open</a>; read it, fix what sounds wrong,
          merge.{' '}
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: 'idle' });
            }}
          >
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
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: 'idle' });
            }}
          >
            Start over
          </button>
        </p>
      )}
    </section>
  );
}
