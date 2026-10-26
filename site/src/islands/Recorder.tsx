// Why: the studio is a private page with one job: let Victor talk and turn that into an origin. This island
// records in the browser, sends the audio to R2, asks for a transcript, and opens the pull request. Some
// thoughts already exist as text (written down, or transcribed elsewhere), so the same island also takes
// words typed or pasted in, with no recording. It is React because the state drives everything on screen.
// Nothing said or written is lost by one press: Discard asks again when there is something to lose, and
// leaving the page while recording asks the browser to check first. A level line shows the microphone is
// hearing, and the words appear as they are heard (Nova-3, live): a preview to check he is understood, while
// the words that land are still written down carefully from the whole recording when he stops. He can pause
// and resume, start over (a second press, since the take is lost), and listen back to the take beside the
// written words before sending. Opened with ?start=1 (the overview's Say it), it starts recording at once. Only a short status
// line is announced to a screen reader, not every change on screen. A gate's answer uses it too (mode
// answer, with deliver): the words go to the gate instead of a pull request of their own, and before sending
// they are shown as they will read, Markdown and all. After a send it says the pull request is open only once
// GitHub has opened it (it takes a minute), and links that pull request, not a list.
import { Markdown } from './Markdown';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MicIcon } from './MicIcon';
import { listenLive, type LiveListening } from './live-listen';
import { noWords, type LiveWords } from '../lib/live-words';

type Phase =
  | { kind: 'idle' }
  | { kind: 'recording'; since: number; pausedAt: number | null; pausedMs: number }
  | { kind: 'uploading' }
  | { kind: 'transcribing'; key: string }
  | { kind: 'ready'; key: string; transcript: string }
  | { kind: 'sending'; key: string; transcript: string }
  | { kind: 'writing'; text: string; sending: boolean }
  | { kind: 'opening'; asked: string; label: string; list: string; late: boolean }
  | { kind: 'sent'; prUrl: string | null }
  | { kind: 'failed'; message: string; retry?: () => void };

interface UploadResponse {
  key: string;
}

interface TranscribeResponse {
  text: string;
}

interface OriginResponse {
  /** When the studio asked GitHub, so the pull request opened since then can be found. */
  asked: string;
  label: string;
  /** GitHub's list of open pull requests with the label, for when it takes longer than it should. */
  list: string;
}

/** How often the studio asks whether GitHub has opened the pull request, and when it says it is late. */
const OPENING_MS = 4_000;
const LATE_MS = 3 * 60_000;

/** What was said or written, handed to whoever takes it instead of the origin pull request. */
export type Delivery =
  { medium: 'voice'; key: string; transcript: string } | { medium: 'text'; transcript: string };

type Mode = 'origin' | 'feedback' | 'answer';

/** The words each mode uses, in one place. */
const copy: Record<
  Mode,
  {
    title: string;
    write: string;
    send: string;
    sending: string;
    textLabel: string;
    textHint: string;
    sent: string;
    again: string;
  }
> = {
  origin: {
    title: 'Say it',
    write: 'Write or paste it instead',
    send: 'Make it an origin',
    sending: 'Opening the pull request…',
    textLabel: 'The words, as they are',
    textHint:
      'Write it here, or paste a transcript from somewhere else. It is kept exactly as it is, typos and all, and marked as text rather than a recording.',
    sent: 'an origin, word for word',
    again: 'Say another',
  },
  feedback: {
    title: 'Say what is wrong',
    write: 'Write it instead',
    send: 'Send the feedback',
    sending: 'Opening the pull request…',
    textLabel: 'What is wrong with the output',
    textHint: 'Say what went down the wrong road, not which sentences to change.',
    sent: 'feedback on that thought',
    again: 'Say more',
  },
  answer: {
    title: 'Say your answers',
    write: 'Write them instead',
    send: 'Send answers',
    sending: 'Sending…',
    textLabel: 'Your answers, in your own words',
    textHint:
      'Kept exactly as written, as an origin beside the first one. Markdown is fine; Preview shows how it reads.',
    sent: 'answers',
    again: 'Answer again',
  },
};

export interface RecorderProps {
  /** 'origin' records a thought; 'feedback' records a note about an output and needs the thought slug;
   * 'answer' answers a gate, and needs deliver. */
  mode: Mode;
  /** Takes the words instead of the origin pull request; returns the pull request to link to, if any. */
  deliver?: (words: Delivery) => Promise<string | null>;
  thoughtSlug?: string;
  /** Told whether something said or written is in hand (not yet sent or discarded), so a parent can hold
   * still around it, as the feedback page does with its choice of thought. */
  onBusyChange?: (busy: boolean) => void;
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
  sending: 'Sending.',
  writing: '',
  opening: 'Sent. Waiting for GitHub to open the pull request.',
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

function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const minutes = String(Math.floor(total / 60));
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function Recorder({
  mode,
  thoughtSlug,
  deliver,
  onBusyChange,
}: RecorderProps): React.JSX.Element {
  const words = copy[mode];
  const [preview, setPreview] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // Once sent, nothing is lost by leaving: GitHub opens the pull request whether the page waits or not.
  const busy = phase.kind !== 'idle' && phase.kind !== 'sent' && phase.kind !== 'opening';
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      onBusyChange?.(false);
    },
    [onBusyChange],
  );
  // Sent: ask every few seconds whether GitHub has opened the pull request, and link it once it has.
  const asked = phase.kind === 'opening' ? phase.asked : null;
  const label = phase.kind === 'opening' ? phase.label : null;
  useEffect(() => {
    if (asked === null || label === null) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/origin?label=${encodeURIComponent(label)}&since=${encodeURIComponent(asked)}`,
        );
        const data = (await response.json().catch(() => null)) as {
          pull?: { url?: unknown } | null;
        } | null;
        const url = data?.pull?.url;
        if (!stopped && typeof url === 'string') {
          setPhase({ kind: 'sent', prUrl: url });
          return;
        }
      } catch {
        // A missed ask is asked again; the send itself already happened.
      }
      if (stopped) return;
      if (Date.now() - Date.parse(asked) > LATE_MS)
        setPhase((at) => (at.kind === 'opening' && !at.late ? { ...at, late: true } : at));
      timer = setTimeout(() => void ask(), OPENING_MS);
    };
    timer = setTimeout(() => void ask(), OPENING_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [asked, label]);
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
  // The words as they are heard, and why there are none when the browser cannot stream them.
  const [live, setLive] = useState<LiveWords>(noWords);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const listening = useRef<LiveListening | null>(null);
  // Start over loses the take, so it waits for a second press, like Discard.
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  // The take, kept in the page so it can be played back beside the written words.
  // Its address is released when it is replaced and when the recorder goes, so no take outlives its page part.
  const [take, setTake] = useState<string | null>(null);
  const takeUrl = useRef<string | null>(null);
  const keep = useCallback((url: string | null) => {
    if (takeUrl.current !== null) URL.revokeObjectURL(takeUrl.current);
    takeUrl.current = url;
    setTake(url);
  }, []);
  // Leaving the page part (another thought chosen, the island removed) never leaves the microphone on:
  // the recording stops without being sent, and its tracks are released.
  useEffect(
    () => () => {
      stopListening.current?.();
      listening.current?.cancel();
      if (takeUrl.current !== null) URL.revokeObjectURL(takeUrl.current);
      const media = recorder.current;
      if (media) {
        media.onstop = null;
        if (media.state !== 'inactive') media.stop();
        media.stream.getTracks().forEach((track) => {
          track.stop();
        });
        recorder.current = null;
      }
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
      keep(null);
      setLive(noWords);
      setLiveNote(null);
      listening.current = listenLive(stream, setLive, setLiveNote);
      setNow(Date.now());
      setPhase({ kind: 'recording', since: Date.now(), pausedAt: null, pausedMs: 0 });
    } catch (error) {
      setPhase({
        kind: 'failed',
        message: `The microphone did not open (${reasonOf(error)}). Allow it for this site in the browser's settings, then start over.`,
      });
    }
  }, [keep]);

  // The overview's Say it opens this page with ?start=1: recording starts at once, and the address forgets
  // it so a reload does not start another.
  useEffect(() => {
    if (mode !== 'origin') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('start') !== '1') return;
    url.searchParams.delete('start');
    window.history.replaceState(null, '', url);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start() sets state only after the microphone opens, never synchronously
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
    (blob: Blob) => {
      // Retry calls this attempt again with the same recording.
      const attempt = async (): Promise<void> => {
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
              void attempt();
            },
          });
        }
      };
      return attempt();
    },
    [mode, thoughtSlug],
  );

  const stop = useCallback(() => {
    const media = recorder.current;
    if (!media) return;
    stopListening.current?.();
    stopListening.current = null;
    listening.current?.stop();
    listening.current = null;
    media.onstop = () => {
      media.stream.getTracks().forEach((track) => {
        track.stop();
      });
      const blob = new Blob(chunks.current, { type: media.mimeType });
      keep(URL.createObjectURL(blob));
      void upload(blob);
    };
    media.stop();
    recorder.current = null;
  }, [keep, upload]);

  // Paused, nothing is recorded and no words are sent; the clock stops with it.
  const pause = useCallback(() => {
    recorder.current?.pause();
    listening.current?.pause();
    setPhase((at) =>
      at.kind === 'recording' && at.pausedAt === null ? { ...at, pausedAt: Date.now() } : at,
    );
  }, []);
  const resume = useCallback(() => {
    recorder.current?.resume();
    listening.current?.resume();
    setPhase((at) =>
      at.kind === 'recording' && at.pausedAt !== null
        ? { ...at, pausedMs: at.pausedMs + Date.now() - at.pausedAt, pausedAt: null }
        : at,
    );
  }, []);

  // Throws this take away, unsent, and records a new one at once.
  const startOver = useCallback(() => {
    setConfirmingRestart(false);
    stopListening.current?.();
    stopListening.current = null;
    listening.current?.cancel();
    listening.current = null;
    const media = recorder.current;
    if (media) {
      media.onstop = null;
      if (media.state !== 'inactive') media.stop();
      media.stream.getTracks().forEach((track) => {
        track.stop();
      });
      recorder.current = null;
    }
    chunks.current = [];
    void start();
  }, [start]);

  const send = useCallback(async () => {
    if (phase.kind !== 'ready') return;
    const { key, transcript } = phase;
    setPhase({ kind: 'sending', key, transcript });
    try {
      if (deliver) {
        setPhase({ kind: 'sent', prUrl: await deliver({ medium: 'voice', key, transcript }) });
        return;
      }
      const body = JSON.stringify({ key, transcript, mode, thought: thoughtSlug ?? null });
      const { asked, label, list } = await postJson<OriginResponse>(
        '/api/origin',
        body,
        'application/json',
      );
      setPhase({ kind: 'opening', asked, label, list, late: false });
    } catch (error) {
      setPhase({
        kind: 'failed',
        message: `${deliver ? 'It was not sent' : 'The pull request did not open'}: ${reasonOf(error)}. The words are kept; try again.`,
        retry: () => {
          void send();
        },
      });
    }
  }, [deliver, mode, phase, thoughtSlug]);

  const sendText = useCallback(
    (text: string) => {
      // Retry calls this attempt again with the same words.
      const attempt = async (): Promise<void> => {
        setPhase({ kind: 'writing', text, sending: true });
        try {
          if (deliver) {
            setPhase({ kind: 'sent', prUrl: await deliver({ medium: 'text', transcript: text }) });
            return;
          }
          const body = JSON.stringify({
            medium: 'text',
            transcript: text,
            mode,
            thought: thoughtSlug ?? null,
          });
          const { asked, label, list } = await postJson<OriginResponse>(
            '/api/origin',
            body,
            'application/json',
          );
          setPhase({ kind: 'opening', asked, label, list, late: false });
        } catch (error) {
          setPhase({
            kind: 'failed',
            message: `${deliver ? 'It was not sent' : 'The pull request did not open'}: ${reasonOf(error)}. The words are kept; try again.`,
            retry: () => {
              void attempt();
            },
          });
        }
      };
      return attempt();
    },
    [deliver, mode, thoughtSlug],
  );

  const title = words.title;
  const writeLabel = words.write;
  const sendLabel = words.send;
  const toIdle = (): void => {
    setConfirmingDiscard(false);
    setPreview(false);
    keep(null);
    setLive(noWords);
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
        {deliver && phase.kind === 'sending'
          ? 'Sending.'
          : deliver && phase.kind === 'sent'
            ? 'Sent. Waiting for GitHub to record it.'
            : spoken[phase.kind]}
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
          <label htmlFor={textId} className="field" hidden={preview}>
            {words.textLabel}
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
          {preview && (
            <div className="preview" aria-label="Preview">
              <Markdown text={phase.text} />
            </div>
          )}
          <p id={`${textId}-hint`} className="small quiet">
            {words.textHint}
          </p>
          <div className="row">
            <button
              type="submit"
              className="control filled"
              disabled={phase.sending || phase.text.trim().length === 0}
            >
              {phase.sending ? words.sending : sendLabel}
            </button>
            {mode === 'answer' && (
              <button
                type="button"
                className="control"
                aria-pressed={preview}
                disabled={phase.text.trim().length === 0}
                onClick={() => {
                  setPreview((now) => !now);
                }}
              >
                Preview
              </button>
            )}
            {discardButton(phase.text.trim().length > 0, phase.sending)}
          </div>
        </form>
      )}

      {phase.kind === 'recording' && (
        <>
          <p className="elapsed">
            <span className="visually-hidden">
              {phase.pausedAt === null ? 'Recording for ' : 'Paused at '}
            </span>
            {formatElapsed((phase.pausedAt ?? now) - phase.since - phase.pausedMs)}
            {phase.pausedAt !== null && <span className="paused"> · paused</span>}
          </p>
          <span className="level" aria-hidden="true">
            <span ref={level} />
          </span>
          <button type="button" className="say-it" onClick={stop}>
            Stop
          </button>
          <div className="row controls">
            <button
              type="button"
              className="control"
              aria-pressed={phase.pausedAt !== null}
              onClick={phase.pausedAt === null ? pause : resume}
            >
              {phase.pausedAt === null ? 'Pause' : 'Resume'}
            </button>
            <button
              type="button"
              className="control discard"
              onClick={() => {
                if (confirmingRestart) startOver();
                else setConfirmingRestart(true);
              }}
              onBlur={() => {
                setConfirmingRestart(false);
              }}
            >
              {confirmingRestart ? 'Throw this take away' : 'Start over'}
            </button>
          </div>
        </>
      )}

      {phase.kind === 'uploading' && <p>Saving the recording…</p>}
      {phase.kind === 'transcribing' && <p>Writing down what you said…</p>}

      {(phase.kind === 'recording' ||
        phase.kind === 'uploading' ||
        phase.kind === 'transcribing') && (
        <div className="live-words">
          <p className="small quiet">
            Heard so far, live. A preview: what lands is written down again, carefully, from the
            whole recording when you stop.
          </p>
          {live.kept === '' && live.guess === '' ? (
            liveNote === null && <p className="quiet">Listening…</p>
          ) : (
            <p>
              {live.kept}
              {live.guess !== '' && <span className="guess"> {live.guess}</span>}
            </p>
          )}
          {/* A failure is said whether or not words came first, so a frozen preview never reads as live. */}
          {liveNote !== null && (
            <p className="quiet">
              {live.kept === '' && live.guess === ''
                ? `No live words: ${liveNote}. The recording goes on.`
                : `Live words stopped here: ${liveNote}. The recording goes on.`}
            </p>
          )}
        </div>
      )}

      {take !== null &&
        (phase.kind === 'transcribing' || phase.kind === 'ready' || phase.kind === 'sending') && (
          <div className="take">
            <p className="small quiet">Listen back before you send it.</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- what was said is written out beside it */}
            <audio controls src={take} aria-label="Your recording" />
          </div>
        )}

      {(phase.kind === 'ready' || phase.kind === 'sending') && (
        <>
          <p className="small quiet">
            This is what you said, written down. It goes in exactly as it is; nothing is tidied
            here.
          </p>
          {mode === 'answer' ? (
            <div className="transcript preview">
              <Markdown text={phase.transcript} />
            </div>
          ) : (
            <blockquote className="transcript">{phase.transcript}</blockquote>
          )}
          <div className="row">
            <button
              type="button"
              className="control filled"
              onClick={() => {
                void send();
              }}
              disabled={phase.kind === 'sending'}
            >
              {phase.kind === 'sending' ? words.sending : sendLabel}
            </button>
            {discardButton(true, phase.kind === 'sending')}
          </div>
        </>
      )}

      {phase.kind === 'sent' && deliver && (
        <div className="done">
          <p>
            Sent. Waiting for GitHub to record your {words.sent}; this page shows the gate closed
            when it has.
            {phase.prUrl !== null && (
              <>
                {' '}
                They land on <a href={phase.prUrl}>the pull request</a>.
              </>
            )}
          </p>
        </div>
      )}

      {phase.kind === 'opening' && (
        <div className="done">
          <p>
            Sent. GitHub is writing the files and opening the pull request, which takes about a
            minute. This page links it as soon as it is open.
          </p>
          {phase.late && (
            <p>
              It is taking longer than usual. <a href={phase.list}>Look at the pull requests</a>;
              this page keeps checking.
            </p>
          )}
        </div>
      )}

      {phase.kind === 'sent' && !deliver && phase.prUrl !== null && (
        <div className="done">
          {mode === 'origin' ? (
            <p>
              Done. <a href={phase.prUrl}>The pull request is open</a>. The interview starts on it
              now and asks its questions, and the rest of the post is built there too, so
              don&rsquo;t merge it yet: the studio asks you to merge when the post is ready.{' '}
              <a href="/studio/agents">Watch it on Agents</a>.
            </p>
          ) : (
            <p>
              Done. <a href={phase.prUrl}>The pull request is open</a>. Merge it and it becomes{' '}
              {words.sent}.
            </p>
          )}
          <button type="button" className="control" onClick={toIdle}>
            {words.again}
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
