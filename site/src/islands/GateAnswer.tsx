// Why: a gate waits on Victor, and this is where he answers it: beside the question, what he is answering
// about (the interview's questions, the structure he is approving) and the pull request it is on. An answer
// can be spoken or written (the studio's recorder, with a preview of how it reads); an approval is Approve,
// or Not this with his words; at the gate before the way out it is Approve and merge, and says what that
// does. What he is answering about is shown as it reads, not as Markdown source.
// Sending only asks GitHub to record it,
// which takes about a minute, so the page says it was sent and is waiting, never that it is done; the run
// turns Done on its own when the workflow has written it. Every control has a label, and the status line is
// announced once.
import { useEffect, useId, useState } from 'react';
import type { GateView } from '../lib/gates';
import { Markdown } from './Markdown';
import { agentName } from '../lib/agent-runs';
import { Recorder, type Delivery } from './Recorder';

interface Context {
  pull: { number: number; url: string } | null;
  context: { label: string; text: string } | null;
}

type Sending =
  | { state: 'idle' }
  | { state: 'sending' }
  /** What was sent decides what the page says next: an approval, or a send-back. */
  | { state: 'sent'; decision: 'approved' | 'redirected' }
  | { state: 'failed'; error: string };

function errorOf(data: unknown, fallback: string): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : fallback;
}

function readContext(data: unknown): Context | null {
  if (typeof data !== 'object' || data === null) return null;
  const { pull, context } = data as { pull?: unknown; context?: unknown };
  const isPull =
    typeof pull === 'object' &&
    pull !== null &&
    typeof (pull as { number?: unknown }).number === 'number' &&
    typeof (pull as { url?: unknown }).url === 'string';
  const isContext =
    typeof context === 'object' &&
    context !== null &&
    typeof (context as { label?: unknown }).label === 'string' &&
    typeof (context as { text?: unknown }).text === 'string';
  return {
    pull: isPull ? (pull as Context['pull']) : null,
    context: isContext ? (context as Context['context']) : null,
  };
}

export interface GateAnswerProps {
  run: string;
  gate: GateView;
  /** Told when the decision has been sent, so the page asks for news more often. */
  onSent: () => void;
  /** The gate before the way out: approving it merges the pull request once its checks pass. */
  merges?: boolean;
  /** Steps before the gate still at work; while any is, a merge is not offered. */
  workingBefore?: readonly string[];
  /**
   * Whether the page knows what is running: still asking, known, or the asking failed. Not knowing is never
   * taken for nothing running, so a merge waits until it is known.
   */
  checking?: 'loading' | 'known' | 'failed';
}

export function GateAnswer({
  run,
  gate,
  onSent,
  merges = false,
  workingBefore = [],
  checking = 'known',
}: GateAnswerProps): React.JSX.Element {
  // Nothing goes live half-written: the merge waits for every step before it to finish.
  const quiet = workingBefore.length === 0;
  const shut = merges && !quiet;
  const id = useId();
  // What the gate is about, and whether it was read with nothing running before the gate: a preview read
  // while a step was still rewriting it is read again once the step finishes.
  const [read, setRead] = useState<{ context: Context | null; quiet: boolean } | null>(null);
  const about = read?.context ?? null;
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [words, setWords] = useState('');
  const [notThis, setNotThis] = useState(false);
  // Merging is public and hard to undo, so it is never one press: the first asks, the second merges.
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState<Sending>({ state: 'idle' });

  useEffect(() => {
    const leaving = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/gates/${encodeURIComponent(run)}`, {
          signal: leaving.signal,
        });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(errorOf(data, 'The studio could not read the gate.'));
        setRead({ context: readContext(data), quiet });
      } catch (error: unknown) {
        if (leaving.signal.aborted) return;
        setAboutError(error instanceof Error ? error.message : 'The studio could not be reached.');
      }
    })();
    return () => {
      leaving.abort();
    };
  }, [run, quiet]);
  // The merge is offered only on what is known: nothing running, and the preview read since.
  const fresh = read !== null && read.quiet === quiet;
  const waits = merges && (shut || checking !== 'known' || (!fresh && aboutError === null));

  const send = async (decision: 'approved' | 'redirected'): Promise<void> => {
    setSending({ state: 'sending' });
    try {
      const response = await fetch(`/api/gates/${encodeURIComponent(run)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, words }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorOf(data, 'The studio could not send it.'));
      setSending({ state: 'sent', decision });
      onSent();
    } catch (error: unknown) {
      setSending({
        state: 'failed',
        error:
          error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'The studio could not be reached. Nothing was sent; try again.',
      });
    }
  };

  /** A spoken or written answer, handed over by the recorder; throws so it can say what failed. */
  const deliver = async (said: Delivery): Promise<string | null> => {
    const response = await fetch(`/api/gates/${encodeURIComponent(run)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'answered',
        words: said.transcript,
        medium: said.medium,
        ...(said.medium === 'voice' ? { key: said.key } : {}),
      }),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorOf(data, 'The studio could not send it.'));
    onSent();
    return about?.pull?.url ?? null;
  };

  const busy = sending.state === 'sending' || sending.state === 'sent';
  const status =
    sending.state === 'sending'
      ? 'Sending…'
      : sending.state !== 'sent'
        ? ''
        : sending.decision === 'redirected'
          ? 'Sent back. GitHub records it, and the steps before this gate run again with your words.'
          : merges
            ? 'Sent. GitHub records your approval, waits for the checks, then merges: a few minutes. This page shows the gate closed when it is recorded.'
            : 'Sent. Waiting for GitHub to record it; this page shows the gate closed when it has.';

  return (
    <section className="gate-answer" aria-labelledby={`${id}-label`}>
      <h2 className="label" id={`${id}-label`}>
        {gate.asks === 'answer' ? 'Your answer' : 'Your decision'}
      </h2>
      <p className="question">{gate.question}</p>
      {about?.pull && (
        <p className="small">
          On <a href={about.pull.url}>pull request #{about.pull.number}</a>
        </p>
      )}
      {aboutError !== null && <p className="small">{aboutError} You can still answer.</p>}
      {about?.context && (
        <details className="context" open>
          <summary>{about.context.label}</summary>
          <div className="context-text">
            <Markdown text={about.context.text} />
          </div>
        </details>
      )}

      {gate.asks === 'answer' && <Recorder mode="answer" deliver={deliver} />}

      {gate.asks === 'approve' && (
        <div className="decide">
          {merges && !shut && checking !== 'known' && (
            <p className="shut" role="status">
              {checking === 'loading'
                ? 'Checking whether anything before this gate is still working…'
                : 'Could not check whether anything before this gate is still working, so merging waits. The page asks again on its own.'}
            </p>
          )}
          {merges && aboutError !== null && (
            <p className="small">
              The preview could not be read: read the pull request before you merge.
            </p>
          )}
          {shut && (
            <p className="shut" role="status">
              {workingBefore.map(agentName).join(' and ')}{' '}
              {workingBefore.length === 1 ? 'is' : 'are'} still working on this post. Merging opens
              when {workingBefore.length === 1 ? 'it finishes' : 'they finish'}; this page shows it.
            </p>
          )}
          {merges && (
            <p className="small">
              Approving merges the pull request once its checks pass on the commit that records your
              approval: the post goes live on the site. A check that fails keeps it out.
            </p>
          )}
          <div className="row">
            <button
              type="button"
              className="control filled"
              disabled={busy || waits}
              onClick={() => {
                if (merges && !confirming) setConfirming(true);
                else void send('approved');
              }}
              onBlur={() => {
                setConfirming(false);
              }}
            >
              {!merges
                ? 'Approve'
                : confirming
                  ? 'Yes, merge: it goes live on the site'
                  : 'Approve and merge'}
            </button>
            <button
              type="button"
              className="control"
              aria-expanded={notThis}
              aria-controls={`${id}-why`}
              disabled={busy}
              onClick={() => {
                setNotThis((now) => !now);
              }}
            >
              Not this
            </button>
          </div>
          {notThis && (
            <form
              id={`${id}-why`}
              onSubmit={(event) => {
                event.preventDefault();
                void send('redirected');
              }}
            >
              <label htmlFor={`${id}-words`} className="field">
                What is wrong, and what you want instead
                <textarea
                  id={`${id}-words`}
                  rows={5}
                  value={words}
                  disabled={busy}
                  onChange={(event) => {
                    setWords(event.target.value);
                  }}
                />
              </label>
              <button type="submit" className="control" disabled={busy || words.trim() === ''}>
                Send it back
              </button>
            </form>
          )}
        </div>
      )}

      {gate.asks === 'pick' && (
        <p className="small quiet">
          Picking from the studio comes later; open the pull request to choose.
        </p>
      )}

      <p className="small" role="status">
        {status}
      </p>
      {sending.state === 'failed' && <p role="alert">{sending.error}</p>}
    </section>
  );
}
