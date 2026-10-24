// Why: the reader's way to talk to the blog. A native <dialog> (focus held inside, Escape closes, the page
// behind is inert), one question at a time, the answer as plain text with links to the posts it came from,
// and a plain note on what happens to the question: it goes to Anthropic to be answered, and nothing is kept.
import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface Source {
  slug: string;
  title: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'asking'; question: string }
  | { kind: 'answered'; question: string; answer: string; sources: Source[] }
  | { kind: 'failed'; question: string; message: string };

const SUGGESTIONS = [
  'What is this blog about, in one minute?',
  'What does "converted with AI" mean here?',
];

function isAnswer(data: unknown): data is { answer: string; sources: Source[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { answer?: unknown }).answer === 'string' &&
    Array.isArray((data as { sources?: unknown }).sources)
  );
}

function errorText(data: unknown): string | null {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : null;
}

export interface AskPanelProps {
  /** The linocut speech bubble shown on the header button. */
  iconSrc: string;
}

export function AskPanel({ iconSrc }: AskPanelProps): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const id = useId();

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (q === '') return;
    setState({ kind: 'asking', question: q });
    setDraft('');
    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isAnswer(data)) {
        setState({ kind: 'answered', question: q, answer: data.answer, sources: data.sources });
      } else {
        setState({
          kind: 'failed',
          question: q,
          message: errorText(data) ?? 'The chat could not answer just now.',
        });
      }
    } catch {
      setState({
        kind: 'failed',
        question: q,
        message: 'The chat could not be reached. Check the connection.',
      });
    }
  }, []);

  const open = useCallback((): void => {
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  }, []);

  // A post's "Ask about this post" button opens the same chat.
  useEffect(() => {
    addEventListener('ask:open', open);
    return () => {
      removeEventListener('ask:open', open);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="control ask-open" onClick={open} aria-haspopup="dialog">
        <img src={iconSrc} alt="" width={20} height={20} />
        <span className="word">Ask</span>
      </button>
      <dialog ref={dialog} className="ask" aria-labelledby={`${id}-title`}>
        <div className="ask-head">
          <h2 id={`${id}-title`}>Ask about the blog</h2>
          <button
            type="button"
            className="ask-close"
            onClick={() => {
              dialog.current?.close();
            }}
          >
            Close
          </button>
        </div>

        <div className="ask-body" aria-live="polite">
          {state.kind === 'idle' && (
            <p className="quiet">
              Ask anything the posts can answer. The answer comes from the posts alone and says
              which ones.
            </p>
          )}
          {state.kind !== 'idle' && <p className="ask-question">{state.question}</p>}
          {state.kind === 'asking' && <p className="quiet">Reading the posts…</p>}
          {state.kind === 'answered' && (
            <>
              {state.answer.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {state.sources.length > 0 && (
                <p className="small">
                  From:{' '}
                  {state.sources.map((s, i) => (
                    <span key={s.slug}>
                      {i > 0 && ', '}
                      <a href={`/thoughts/${s.slug}`}>{s.title}</a>
                    </span>
                  ))}
                </p>
              )}
            </>
          )}
          {state.kind === 'failed' && <p role="alert">{state.message}</p>}
        </div>

        {state.kind !== 'asking' && (
          <div className="ask-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  void ask(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
        >
          <label htmlFor={`${id}-q`} className="visually-hidden">
            Your question
          </label>
          <textarea
            id={`${id}-q`}
            ref={input}
            rows={2}
            maxLength={500}
            value={draft}
            placeholder="Ask about a post…"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
          />
          <button type="submit" disabled={state.kind === 'asking' || draft.trim() === ''}>
            Ask
          </button>
        </form>
        <p className="small quiet ask-note">
          Answered by Claude, from the published posts only. Your question goes to Anthropic to be
          answered; nothing is stored here.
        </p>
      </dialog>
    </>
  );
}
