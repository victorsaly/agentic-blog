// Why: the reader's way to talk to the blog. A panel docked beside the page (full screen on a phone), so the
// post stays readable while you ask. It is a conversation: follow-ups carry the earlier turns. On a post the
// reader chooses whether answers come from this post or every post, and can select a passage and ask about
// it. Most of the panel is given to the answers: suggestions and the note on privacy live in the empty
// thread, and the box to type in grows only as far as the question does. A new question scrolls to its own
// top, so the answer is read from its first line. Answers link to the exact place that answers them (a
// section of the road, a note in the origin); following one keeps the conversation, held in this tab only,
// and on a desk the panel opens again beside the page it led to. While an answer is on its way its block is
// already drawn, so nothing jumps. A plain note says what happens to a question: it goes to Anthropic to
// be answered, and nothing is kept on the site.
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { blocksOf, isPlace, plainText, type Inline } from '../lib/answer-text';
import { isListenRequest } from '../lib/read-along';
import { NARROW, useDock } from './use-dock';

interface Source {
  slug: string;
  title: string;
}

interface Place {
  href: string;
  name: string;
  post: string;
}

interface Turn {
  id: number;
  question: string;
  quote?: string;
  /** Whether the answer was to come from the one post the reader was on. */
  fromPost?: boolean;
  state: 'asking' | 'answered' | 'failed';
  answer?: string;
  sources?: Source[];
  places?: Place[];
  message?: string;
}

interface Post {
  slug: string;
  title: string;
}

const SITE_SUGGESTIONS = [
  'What is this blog about, in one minute?',
  'Which post should I read first?',
  'How does AI help write these posts?',
  'What do the sources behind the posts say?',
];
const POST_SUGGESTIONS = [
  'What is the point of this post?',
  'Where in the road should I start?',
  'What changed from the original note?',
];
/** Offered on a post whose idea has a recording. */
const LISTEN_SUGGESTION = 'Read the idea to me.';
const PASSAGE_SUGGESTIONS = [
  'Explain this passage in plain words.',
  'Where does this come from in the original note?',
];
const MAX_QUESTION = 500;
/** The conversation lives in this tab only, so following a link in an answer does not lose it. */
const KEPT = 'ask:conversation';

function isAnswer(data: unknown): data is { answer: string; sources: Source[]; places?: Place[] } {
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

interface Kept {
  turns: Turn[];
  reopen: boolean;
}

function readKept(): Kept | null {
  try {
    const raw = sessionStorage.getItem(KEPT);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data !== 'object' || data === null) return null;
    const turns = (data as { turns?: unknown }).turns;
    if (!Array.isArray(turns)) return null;
    return {
      turns: turns.filter(
        (t): t is Turn =>
          typeof t === 'object' &&
          t !== null &&
          typeof (t as Turn).id === 'number' &&
          typeof (t as Turn).question === 'string' &&
          ((t as Turn).state === 'answered' || (t as Turn).state === 'failed'),
      ),
      reopen: (data as { reopen?: unknown }).reopen === true,
    };
  } catch {
    return null;
  }
}

function keep(kept: Kept): void {
  try {
    if (kept.turns.length === 0) sessionStorage.removeItem(KEPT);
    else sessionStorage.setItem(KEPT, JSON.stringify(kept));
  } catch {
    /* storage is off: the conversation simply ends with the page */
  }
}

const settled = (turns: Turn[]): Turn[] => turns.filter((t) => t.state !== 'asking');

const scrollBehaviour = (): ScrollBehavior =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export interface AskPanelProps {
  /** The linocut speech bubble shown on the header button. */
  iconSrc: string;
}

export function AskPanel({ iconSrc }: AskPanelProps): React.JSX.Element {
  // Taken apart so only the two refs count as refs: the compiler treats a whole object as one once any
  // field of it is handed to ref=.
  const { dialog, trigger, isOpen, open: openDock, close: closeDock, dialogProps } = useDock('ask');
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
  const [copied, setCopied] = useState<number | null>(null);
  const [listenable, setListenable] = useState(false);
  const nextId = useRef(1);
  const restored = useRef(false);
  const id = useId();
  const asking = turns.some((t) => t.state === 'asking');

  const openPanel = useCallback((): void => {
    openDock();
    input.current?.focus();
  }, [openDock]);

  // On arrival: this page's post, and the conversation this tab was having before a link brought it here.
  useEffect(() => {
    if (restored.current) return;
    setPost(currentPost());
    const kept = readKept();
    if (kept && kept.turns.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this tab's storage exists only in the browser, after hydration
      setTurns(kept.turns);
      nextId.current = Math.max(...kept.turns.map((t) => t.id)) + 1;
      if (kept.reopen && !matchMedia(NARROW).matches) openPanel();
    }
    restored.current = true;
  }, [openPanel]);

  // The post's read-aloud row shows itself once it has checked the voice against the page.
  useEffect(() => {
    const check = (): void => {
      setListenable(document.querySelector('[data-read-along]:not([hidden])') !== null);
    };
    check();
    addEventListener('listen:ready', check);
    return () => {
      removeEventListener('listen:ready', check);
    };
  }, []);

  useEffect(() => {
    if (restored.current) keep({ turns: settled(turns), reopen: false });
  }, [turns]);

  const ask = useCallback(
    async (question: string, about: string | null = null) => {
      const q = question.replace(/\s+/g, ' ').trim();
      if (q === '' || turns.some((t) => t.state === 'asking')) return;
      const turnId = nextId.current++;
      // "Play it" on a post is answered here, not by the model: the post reads its idea aloud.
      if (post && !about && isListenRequest(q)) {
        const playable = document.querySelector('[data-read-along]:not([hidden])') !== null;
        setTurns((all) => [
          ...all,
          {
            id: turnId,
            question: q,
            state: 'answered',
            fromPost: true,
            answer: playable
              ? 'Playing the idea, read aloud word for word. The word being said is underlined in the text; press Listen to pause.'
              : 'This post has no recording yet, so there is nothing to play. The idea is one screen to read.',
          },
        ]);
        setDraft('');
        if (playable) {
          if (matchMedia(NARROW).matches) closeDock(false);
          dispatchEvent(new CustomEvent('listen:play'));
        }
        return;
      }
      const history = turns
        .filter((t) => t.state === 'answered' && t.answer)
        .slice(-4)
        .map((t) => ({ question: t.question, answer: t.answer ?? '' }));
      setTurns((all) => [
        ...all,
        {
          id: turnId,
          question: q,
          state: 'asking',
          fromPost: Boolean(post && scope === 'post'),
          ...(about ? { quote: about } : {}),
        },
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
          settle({
            state: 'answered',
            answer: data.answer,
            sources: data.sources,
            places: (data.places ?? []).filter((p) => isPlace(p.href)),
          });
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
    [turns, post, scope, closeDock],
  );

  // A new question scrolls to its own top, so its answer is read from the first line, not the last.
  const shown = useRef(0);
  useLayoutEffect(() => {
    const box = thread.current;
    if (!box || turns.length === shown.current) return;
    const grew = turns.length > shown.current;
    shown.current = turns.length;
    const last = box.querySelector<HTMLElement>('.turn:last-child');
    if (!grew || !last) return;
    box.scrollTo({ top: Math.max(0, last.offsetTop - 8), behavior: scrollBehaviour() });
  }, [turns]);

  // The box to type in grows with the question, up to a few lines, then scrolls.
  useLayoutEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${String(box.scrollHeight + 2)}px`;
  }, [draft]);

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
        if (
          !sel ||
          text.length < 3 ||
          !element?.closest('[data-post] .panel, [data-post] .transcript')
        ) {
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

  // A link in an answer: on this page it opens the place (and its tab) without a reload; on a phone the
  // panel steps aside so the place is seen. To another page, the conversation goes along, and on a desk
  // the panel opens again there.
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, href: string): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const url = new URL(href, location.href);
    const narrow = matchMedia(NARROW).matches;
    const path = (p: string): string => p.replace(/\/$/, '');
    if (path(url.pathname) !== path(location.pathname)) {
      keep({ turns: settled(turns), reopen: !narrow });
      return;
    }
    event.preventDefault();
    if (narrow) closeDock(false);
    history.pushState(null, '', url.hash || location.pathname);
    const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    if (target?.closest('[role="tabpanel"]')) dispatchEvent(new HashChangeEvent('hashchange'));
    else (target ?? document.body).scrollIntoView({ behavior: scrollBehaviour() });
  };

  const inline = (parts: Inline[]): React.ReactNode =>
    parts.map((part, i) =>
      part.kind === 'link' ? (
        <a
          key={i}
          href={part.href}
          onClick={(event) => {
            follow(event, part.href);
          }}
        >
          {part.text}
        </a>
      ) : part.kind === 'bold' ? (
        <strong key={i}>{part.text}</strong>
      ) : (
        <Fragment key={i}>{part.text}</Fragment>
      ),
    );

  // Where the answer points: the places it links to, then any post it used that it did not link.
  const goTo = (turn: Turn): React.ReactNode => {
    const places = turn.places ?? [];
    const linkedPosts = new Set(places.map((p) => p.post));
    const posts = (turn.sources ?? [])
      .filter((s) => !linkedPosts.has(s.title))
      .map((s) => ({ href: `/thoughts/${s.slug}`, name: s.title, post: '' }));
    const rows = [...places, ...posts];
    if (rows.length === 0) return null;
    return (
      <nav className="go-to" aria-label="Where this answer comes from">
        <p className="small-label">Go to</p>
        <ul>
          {rows.map((row) => (
            <li key={row.href}>
              <a
                href={row.href}
                onClick={(event) => {
                  follow(event, row.href);
                }}
              >
                <span className="where">
                  <span className="name">{row.name}</span>
                  {row.post && <span className="small quiet">{row.post}</span>}
                </span>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="2" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  };

  const fromPost = Boolean(post && scope === 'post');
  const suggestions = quote
    ? PASSAGE_SUGGESTIONS
    : fromPost
      ? [...(listenable ? [LISTEN_SUGGESTION] : []), ...POST_SUGGESTIONS]
      : SITE_SUGGESTIONS;

  return (
    <>
      <button
        type="button"
        className="control ask-open"
        ref={trigger}
        onClick={() => {
          if (isOpen) closeDock();
          else openPanel();
        }}
        aria-expanded={isOpen}
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
        ref={dialog}
        id={`${id}-dock`}
        className="dock ask"
        aria-labelledby={`${id}-title`}
        {...dialogProps}
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
              closeDock();
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {post && (
          <div className="dock-scope" role="radiogroup" aria-labelledby={`${id}-scope`}>
            <span id={`${id}-scope`} className="small quiet">
              Answers from
            </span>
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
          </div>
        )}

        <div className="dock-scroll" ref={thread} aria-live="polite">
          {turns.length === 0 && (
            <div className="ask-empty">
              <p className="lede">
                {fromPost && post
                  ? `Ask anything “${post.title}” can answer. The answer comes from this post alone, and links to the place that says it.`
                  : 'Ask anything the posts can answer. The answer comes from the posts alone, and links to the place that says it.'}
              </p>
              <p className="small-label">Try asking</p>
              <ul className="suggestions">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => {
                        void ask(s, quote);
                      }}
                    >
                      <span>{s}</span>
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="small quiet note">
                Answered by Claude from the published posts and originals only. Your question goes
                to Anthropic to be answered; nothing is stored on this site. The conversation stays
                in this tab, so a link can take you to a post and back, and it is gone when you
                close the tab.
              </p>
            </div>
          )}
          {turns.map((turn) => (
            <div key={turn.id} className="turn">
              <div className="asked arrive">
                <p className="small-label">You asked</p>
                <p className="question">{turn.question}</p>
                {turn.quote && <p className="about small quiet">about: “{turn.quote}”</p>}
              </div>
              <div className="answer arrive" aria-busy={turn.state === 'asking'}>
                <p className="small-label">{turn.fromPost ? 'From this post' : 'From the posts'}</p>
                {turn.state === 'asking' && (
                  <>
                    <p className="waiting small quiet">
                      <span className="dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      {turn.fromPost ? 'Reading this post…' : 'Reading the posts…'}
                    </p>
                    <span className="skeleton" style={{ width: '100%' }} />
                    <span className="skeleton" style={{ width: '94%' }} />
                    <span className="skeleton" style={{ width: '62%' }} />
                  </>
                )}
                {turn.state === 'answered' && (
                  <>
                    {blocksOf(turn.answer ?? '').map((block, i) =>
                      block.kind === 'list' ? (
                        <ul key={i}>
                          {block.items.map((item, j) => (
                            <li key={j}>{inline(item)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p key={i}>{inline(block.parts)}</p>
                      ),
                    )}
                    {goTo(turn)}
                    <button
                      type="button"
                      className="control copy"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(plainText(turn.answer ?? '', location.origin))
                          .then(() => {
                            setCopied(turn.id);
                            setTimeout(() => {
                              setCopied((c) => (c === turn.id ? null : c));
                            }, 2000);
                          });
                      }}
                    >
                      {copied === turn.id ? (
                        <svg
                          aria-hidden="true"
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path d="M2 8.5l4 4 8-9" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path d="M5 5V1.5h9.5V11H11" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M1.5 5h9.5v9.5H1.5z" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                      <span>{copied === turn.id ? 'Copied' : 'Copy the answer'}</span>
                    </button>
                  </>
                )}
                {turn.state === 'failed' && (
                  <>
                    <p role="alert">{turn.message}</p>
                    <button
                      type="button"
                      className="control"
                      disabled={asking}
                      onClick={() => {
                        setTurns((all) => all.filter((t) => t.id !== turn.id));
                        void ask(turn.question, turn.quote ?? null);
                      }}
                    >
                      Try again
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          className="dock-foot"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft, quote);
          }}
        >
          <label htmlFor={`${id}-q`} className="visually-hidden">
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
              rows={1}
              maxLength={MAX_QUESTION}
              value={draft}
              placeholder={
                turns.length > 0
                  ? 'Ask a follow-up…'
                  : fromPost
                    ? 'Ask about this post…'
                    : 'Ask the blog…'
              }
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
            <span className={asking ? undefined : 'keys'}>
              {asking ? 'Answer on its way…' : 'Enter sends · Shift and Enter for a new line'}
            </span>
            {draft.length > MAX_QUESTION - 100 && (
              <span>
                {draft.length} / {MAX_QUESTION}
              </span>
            )}
          </p>
        </form>
      </dialog>
    </>
  );
}
