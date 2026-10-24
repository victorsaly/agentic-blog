// Why: the reader's way to talk to the blog. A panel docked beside the page (full screen on a phone), so the
// post stays readable while you ask. It is a conversation: follow-ups carry the earlier turns. On a post the
// reader chooses whether answers come from this post or every post, and can select a passage and ask about
// it. While an answer is on its way its block is already drawn at its final size, so nothing jumps. A plain
// note says what happens to a question: it goes to Anthropic to be answered, and nothing is kept.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useDock } from './use-dock';

interface Source {
  slug: string;
  title: string;
}

interface Turn {
  id: number;
  question: string;
  quote?: string;
  state: 'asking' | 'answered' | 'failed';
  answer?: string;
  sources?: Source[];
  message?: string;
}

interface Post {
  slug: string;
  title: string;
}

const SITE_SUGGESTIONS = [
  'What is this blog about, in one minute?',
  'What does "converted with AI" mean here?',
];
const POST_SUGGESTIONS = [
  'What is the point of this post?',
  'What changed from the original note?',
];
const MAX_QUESTION = 500;

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

/** The post this page is, if it is one: the post page marks its article with its slug and title. */
function currentPost(): Post | null {
  const article = document.querySelector<HTMLElement>('[data-post]');
  const slug = article?.getAttribute('data-post');
  const title = article?.getAttribute('data-post-title');
  return slug && title ? { slug, title } : null;
}

export interface AskPanelProps {
  /** The linocut speech bubble shown on the header button. */
  iconSrc: string;
}

export function AskPanel({ iconSrc }: AskPanelProps): React.JSX.Element {
  const dock = useDock('ask');
  const input = useRef<HTMLTextAreaElement | null>(null);
  const thread = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [scope, setScope] = useState<'post' | 'all'>('post');
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(
    null,
  );
  const nextId = useRef(1);
  const id = useId();
  const asking = turns.some((t) => t.state === 'asking');

  useEffect(() => {
    setPost(currentPost());
  }, []);

  const ask = useCallback(
    async (question: string, about: string | null = null) => {
      const q = question.replace(/\s+/g, ' ').trim();
      if (q === '' || turns.some((t) => t.state === 'asking')) return;
      const turnId = nextId.current++;
      const history = turns
        .filter((t) => t.state === 'answered' && t.answer)
        .slice(-4)
        .map((t) => ({ question: t.question, answer: t.answer ?? '' }));
      setTurns((all) => [
        ...all,
        { id: turnId, question: q, state: 'asking', ...(about ? { quote: about } : {}) },
      ]);
      setDraft('');
      setQuote(null);
      const settle = (patch: Partial<Turn>): void => {
        setTurns((all) => all.map((t) => (t.id === turnId ? { ...t, ...patch } : t)));
      };
      try {
        const response = await fetch('/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            question: q,
            history,
            ...(about ? { quote: about } : {}),
            ...(post && scope === 'post' ? { post: post.slug } : {}),
          }),
        });
        const data: unknown = await response.json().catch(() => null);
        if (response.ok && isAnswer(data))
          settle({ state: 'answered', answer: data.answer, sources: data.sources });
        else
          settle({
            state: 'failed',
            message: errorText(data) ?? 'The chat could not answer just now.',
          });
      } catch {
        settle({
          state: 'failed',
          message: 'The chat could not be reached. Check the connection.',
        });
      }
    },
    [turns, post, scope],
  );

  // Keep the newest turn in view as it lands.
  useEffect(() => {
    const box = thread.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [turns]);

  const openPanel = useCallback((): void => {
    dock.open();
    input.current?.focus();
  }, [dock]);

  // A post's "Ask about this post" button and the home page's question open the same chat; a question
  // that comes with the event is asked straight away.
  useEffect(() => {
    const onAsk = (event: Event): void => {
      openPanel();
      const detail: unknown = event instanceof CustomEvent ? event.detail : null;
      const question =
        typeof detail === 'object' && detail !== null
          ? (detail as { question?: unknown }).question
          : undefined;
      if (typeof question === 'string') void ask(question);
    };
    addEventListener('ask:open', onAsk);
    return () => {
      removeEventListener('ask:open', onAsk);
    };
  }, [openPanel, ask]);

  // On a post: text selected in the post grows a button to ask about that passage.
  useEffect(() => {
    if (!post) return;
    let timer = 0;
    const onChange = (): void => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const sel = getSelection();
        const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? '';
        const node = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).commonAncestorContainer : null;
        const element = node instanceof Element ? node : node?.parentElement;
        if (!sel || text.length < 3 || !element?.closest('[data-post] .panel')) {
          setSelection(null);
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({
          text: text.slice(0, 400),
          top: Math.max(8, rect.top - 52),
          left: Math.min(Math.max(8, rect.left), innerWidth - 260),
        });
      }, 150);
    };
    document.addEventListener('selectionchange', onChange);
    return () => {
      document.removeEventListener('selectionchange', onChange);
      clearTimeout(timer);
    };
  }, [post]);

  const suggestions = post && scope === 'post' ? POST_SUGGESTIONS : SITE_SUGGESTIONS;

  return (
    <>
      <button
        type="button"
        className="control ask-open"
        ref={(el) => {
          dock.trigger.current = el;
        }}
        onClick={() => {
          if (dock.isOpen) dock.close();
          else openPanel();
        }}
        aria-expanded={dock.isOpen}
        aria-controls={`${id}-dock`}
      >
        <img src={iconSrc} alt="" width={20} height={20} />
        <span className="word">Ask</span>
      </button>

      {selection && (
        <button
          type="button"
          className="control ask-selection"
          style={{ top: selection.top, left: selection.left }}
          onMouseDown={(event) => {
            event.preventDefault(); // keep the selection while the button is pressed
          }}
          onClick={() => {
            setQuote(selection.text);
            setSelection(null);
            openPanel();
          }}
        >
          <img src={iconSrc} alt="" width={18} height={18} />
          Ask about this passage
        </button>
      )}

      <dialog
        ref={dock.dialog}
        id={`${id}-dock`}
        className="dock ask"
        aria-labelledby={`${id}-title`}
        {...dock.dialogProps}
      >
        <div className="dock-head">
          <h2 id={`${id}-title`}>Ask</h2>
          {turns.length > 0 && (
            <button
              type="button"
              className="control"
              onClick={() => {
                setTurns([]);
                input.current?.focus();
              }}
              disabled={asking}
            >
              New conversation
            </button>
          )}
          <button
            type="button"
            className="control"
            aria-label="Close the chat"
            onClick={() => {
              dock.close();
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {post && (
          <div className="dock-section">
            <fieldset className="choice">
              <legend>Answers come from</legend>
              <div className="segmented">
                <label>
                  <input
                    type="radio"
                    name={`${id}-scope`}
                    checked={scope === 'post'}
                    onChange={() => {
                      setScope('post');
                    }}
                  />
                  This post
                </label>
                <label>
                  <input
                    type="radio"
                    name={`${id}-scope`}
                    checked={scope === 'all'}
                    onChange={() => {
                      setScope('all');
                    }}
                  />
                  Every post
                </label>
              </div>
            </fieldset>
          </div>
        )}

        <div className="dock-scroll" ref={thread} aria-live="polite">
          {turns.length === 0 && (
            <p className="quiet ask-empty">
              {post && scope === 'post'
                ? `Ask anything “${post.title}” can answer. The answer comes from this post alone.`
                : 'Ask anything the posts can answer. The answer comes from the posts alone and says which ones.'}
            </p>
          )}
          {turns.map((turn) => (
            <div key={turn.id} className="turn">
              <div className="asked arrive">
                <p className="small-label">You asked</p>
                <p className="question">{turn.question}</p>
                {turn.quote && <p className="about small quiet">about: “{turn.quote}”</p>}
              </div>
              <div className="answer arrive" aria-busy={turn.state === 'asking'}>
                <p className="small-label">From the posts</p>
                {turn.state === 'asking' && (
                  <>
                    <p className="waiting small quiet">
                      <span className="dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      {post && scope === 'post' ? 'Reading this post…' : 'Reading the posts…'}
                    </p>
                    <span className="skeleton" style={{ width: '100%' }} />
                    <span className="skeleton" style={{ width: '94%' }} />
                    <span className="skeleton" style={{ width: '62%' }} />
                  </>
                )}
                {turn.state === 'answered' && (
                  <>
                    {(turn.answer ?? '').split(/\n{2,}/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                    {(turn.sources ?? []).length > 0 && (
                      <ul className="sources">
                        {(turn.sources ?? []).map((s) => (
                          <li key={s.slug}>
                            <a href={`/thoughts/${s.slug}`}>{s.title}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="control copy"
                      onClick={(event) => {
                        const button = event.currentTarget;
                        void navigator.clipboard.writeText(turn.answer ?? '').then(() => {
                          button.textContent = 'Copied';
                          setTimeout(() => {
                            button.textContent = 'Copy the answer';
                          }, 2000);
                        });
                      }}
                    >
                      Copy the answer
                    </button>
                  </>
                )}
                {turn.state === 'failed' && <p role="alert">{turn.message}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="dock-foot">
          {turns.length === 0 && (
            <>
              <p className="small quiet try">Try asking</p>
              <div className="suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="control"
                    onClick={() => {
                      void ask(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft, quote);
            }}
          >
            <label htmlFor={`${id}-q`} className="small-label">
              Your question
            </label>
            {quote && (
              <p className="about small">
                <span>about: “{quote}”</span>
                <button
                  type="button"
                  className="control"
                  aria-label="Ask without this passage"
                  onClick={() => {
                    setQuote(null);
                  }}
                >
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </p>
            )}
            <div className="welded">
              <textarea
                id={`${id}-q`}
                ref={input}
                rows={2}
                maxLength={MAX_QUESTION}
                value={draft}
                placeholder={turns.length > 0 ? 'Ask a follow-up…' : 'Ask about a post…'}
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (!asking) void ask(draft, quote);
                  }
                }}
              />
              <button type="submit" disabled={asking || draft.trim() === ''}>
                Ask
              </button>
            </div>
            <p className="small quiet hint">
              <span>
                {asking
                  ? 'Answer on its way. Enter sends once it lands.'
                  : 'Enter sends · Shift and Enter for a new line'}
              </span>
              <span>
                {draft.length} / {MAX_QUESTION}
              </span>
            </p>
          </form>
          <p className="small quiet note">
            Answered by Claude from the published posts and originals only. Your question goes to
            Anthropic to be answered; nothing is stored here. The conversation is gone when you
            close the tab.
          </p>
        </div>
      </dialog>
    </>
  );
}
