// Why: the studio is a private page with one job: let Victor talk and turn that into an origin. This island
// records in the browser, sends the audio to R2, asks for a transcript, and opens the pull request. Some
// thoughts already exist as text (written down, or transcribed elsewhere), so the same island also takes
// words typed or pasted in, with no recording. It is React because the state drives everything on screen.
// Nothing said or written is lost by one press: Discard asks again when there is something to lose, and
// leaving the page while recording asks the browser to check first. A level line shows the microphone is
// hearing. Opened with ?start=1 (the overview's Say it), it starts recording at once. Only a short status
// line is announced to a screen reader, not every change on screen.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MicIcon } from './MicIcon';

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
    let reason = text || response.statusText;
    try {
      const data: unknown = JSON.parse(text);
      if (
        typeof data === 'object' &&
        data !== null &&
        typeof (data as { error?: unknown }).error === 'string'
      )
        reason = (data as { error: string }).error;
    } catch {
      /* not JSON: the text itself is the reason */
    }
    throw new Error(`${reason} (${String(response.status)})`);
  }
  const data: unknown = await response.json();
  return data as T;
}

/** What went wrong, without the "Error:" a thrown error prints with. */
function reasonOf(error: unknown): string {
  if (error instanceof Error)
    return error.message === 'Failed to fetch' ? 'the studio could not be reached' : error.message;
  return String(error);
}

/** What a screen reader hears as the recorder moves on: one short line, never the whole section. */
const spoken: Record<Phase['kind'], string> = {
  idle: '',
  recording: 'Recording.',
  uploading: 'Saving the recording.',
  transcribing: 'Writing down what you said.',
  ready: 'Written down. Read it, then send it or discard it.',
  sending: 'Opening the pull request.',
  writing: '',
  sent: 'Done. The pull request is open.',
  failed: '',
};

/** Shows how loud the microphone hears, by stretching a line; returns how to stop. A browser without audio
 * analysis simply shows no line. */
function listen(stream: MediaStream, bar: React.RefObject<HTMLSpanElement | null>): () => void {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const draw = (): void => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const v = (sample - 128) / 128;
        sum += v * v;
      }
      const loudness = Math.min(1, Math.sqrt(sum / samples.length) * 4);
      if (bar.current) bar.current.style.transform = `scaleX(${loudness.toFixed(3)})`;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      void context.close();
    };
  } catch {
    return () => undefined;
  }
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
  // Discard on something that would be lost waits for a second press.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const level = useRef<HTMLSpanElement | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      stopListening.current?.();
    },
    [],
  );

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
      stopListening.current = listen(stream, level);
      setNow(Date.now());
      setPhase({ kind: 'recording', since: Date.now() });
    } catch (error) {
      setPhase({
        kind: 'failed',
        message: `The microphone did not open (${reasonOf(error)}). Allow it for this site in the browser's settings, then start over.`,
      });
    }
  }, []);

  // The overview's Say it opens this page with ?start=1: recording starts at once, and the address forgets
  // it so a reload does not start another.
  useEffect(() => {
    if (mode !== 'origin') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('start') !== '1') return;
    url.searchParams.delete('start');
    window.history.replaceState(null, '', url);
    void start();
  }, [mode, start]);

  // Leaving while recording would lose it; the browser asks first.
  const recording = phase.kind === 'recording';
  useEffect(() => {
    if (!recording) return undefined;
    const hold = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', hold);
    return () => {
      window.removeEventListener('beforeunload', hold);
    };
  }, [recording]);

  const upload = useCallback(
    async (blob: Blob) => {
      setPhase({ kind: 'uploading' });
      try {
        const form = new FormData();
        form.set('audio', blob, `${mode}-${new Date().toISOString()}.webm`);
        form.set('mode', mode);
        if (thoughtSlug) form.set('thought', thoughtSlug);
        let saved = false;
        try {
          const { key } = await postJson<UploadResponse>('/api/upload', form);
          saved = true;
          setPhase({ kind: 'transcribing', key });
          const { text } = await postJson<TranscribeResponse>(
            '/api/transcribe',
            JSON.stringify({ key }),
            'application/json',
          );
          setPhase({ kind: 'ready', key, transcript: text });
        } catch (error) {
          throw new Error(
            saved
              ? `The recording is saved, but it could not be written down: ${reasonOf(error)}.`
              : `The recording could not be saved: ${reasonOf(error)}. It is still in this page; try again.`,
          );
        }
      } catch (error) {
        setPhase({
          kind: 'failed',
          message: reasonOf(error),
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
    stopListening.current?.();
    stopListening.current = null;
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
        message: `The pull request did not open: ${reasonOf(error)}. The words are kept; try again.`,
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
          message: `The pull request did not open: ${reasonOf(error)}. The words are kept; try again.`,
          retry: () => {
            void sendText(text);
          },
        });
      }
    },
    [mode, thoughtSlug],
  );

  const title = mode === 'origin' ? 'Say it' : 'Say what is wrong';
  const writeLabel = mode === 'origin' ? 'Write or paste it instead' : 'Write it instead';
  const sendLabel = mode === 'origin' ? 'Make it an origin' : 'Send the feedback';
  const toIdle = (): void => {
    setConfirmingDiscard(false);
    setPhase({ kind: 'idle' });
  };
  // A second press on Discard when there is something to lose; the first only asks.
  const discard = (somethingToLose: boolean): void => {
    if (somethingToLose && !confirmingDiscard) setConfirmingDiscard(true);
    else toIdle();
  };
  const discardButton = (somethingToLose: boolean, disabled: boolean): React.JSX.Element => (
    <button
      type="button"
      className="control discard"
      disabled={disabled}
      onClick={() => {
        discard(somethingToLose);
      }}
      onBlur={() => {
        setConfirmingDiscard(false);
      }}
    >
      {confirmingDiscard ? 'Discard it for good' : 'Discard'}
    </button>
  );

  return (
    <section className="recorder">
      <p className="visually-hidden" role="status">
        {spoken[phase.kind]}
      </p>
      {phase.kind === 'idle' && (
        <>
          <button
            type="button"
            className="say-it"
            onClick={() => {
              void start();
            }}
          >
            <MicIcon />
            {title}
          </button>
          <button
            type="button"
            className="control alternative"
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
            <button
              type="submit"
              className="control filled"
              disabled={phase.sending || phase.text.trim().length === 0}
            >
              {phase.sending ? 'Opening the pull request…' : sendLabel}
            </button>
            {discardButton(phase.text.trim().length > 0, phase.sending)}
          </div>
        </form>
      )}

      {phase.kind === 'recording' && (
        <>
          <p className="elapsed">
            <span className="visually-hidden">Recording for </span>
            {formatElapsed(phase.since, now)}
          </p>
          <span className="level" aria-hidden="true">
            <span ref={level} />
          </span>
          <button type="button" className="say-it" onClick={stop}>
            Stop
          </button>
        </>
      )}

      {phase.kind === 'uploading' && <p>Saving the recording…</p>}
      {phase.kind === 'transcribing' && <p>Writing down what you said…</p>}

      {(phase.kind === 'ready' || phase.kind === 'sending') && (
        <>
          <p className="small quiet">
            This is what you said, written down. It goes in exactly as it is; nothing is tidied
            here.
          </p>
          <blockquote className="transcript">{phase.transcript}</blockquote>
          <div className="row">
            <button
              type="button"
              className="control filled"
              onClick={() => {
                void send();
              }}
              disabled={phase.kind === 'sending'}
            >
              {phase.kind === 'sending' ? 'Opening the pull request…' : sendLabel}
            </button>
            {discardButton(true, phase.kind === 'sending')}
          </div>
        </>
      )}

      {phase.kind === 'sent' && (
        <div className="done">
          <p>
            Done. <a href={phase.prUrl}>The pull request is open</a>. Merge it and it becomes{' '}
            {mode === 'origin' ? 'an origin, word for word' : 'feedback on that thought'}.
          </p>
          <button type="button" className="control" onClick={toIdle}>
            {mode === 'origin' ? 'Say another' : 'Say more'}
          </button>
        </div>
      )}

      {phase.kind === 'failed' && (
        <div className="failed" role="alert">
          <p>{phase.message}</p>
          <div className="row">
            {phase.retry && (
              <button type="button" className="control filled" onClick={phase.retry}>
                Try again
              </button>
            )}
            <button type="button" className="control" onClick={toIdle}>
              Start over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
