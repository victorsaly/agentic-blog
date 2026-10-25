// Why: readers may answer a post. This shows the comments Victor has approved, and a short form to add one
// (a name, an optional email that only Victor sees, and the words). Nothing a reader sends appears until
// Victor approves it, so the form says so and keeps the promise. Turnstile loads only when the reader starts
// writing, so a reader who just reads never talks to a third party. Everything shown is plain text.
import { useEffect, useId, useRef, useState } from 'react';
import {
  MAX_BODY,
  MAX_EMAIL,
  MAX_NAME,
  mergeById,
  readCommentsReply,
  type PublicComment,
} from '../lib/comments';

interface TurnstileApi {
  render: (
    target: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widget?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile did not start'));
    };
    script.onerror = () => {
      reject(new Error('Turnstile did not load'));
    };
    document.head.appendChild(script);
  });
}

type Load =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      comments: PublicComment[];
      siteKey: string | null;
      next: number | null;
      more: 'idle' | 'loading' | 'failed';
    }
  | { kind: 'failed' };

type Sending =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; message: string }
  | { kind: 'failed'; message: string };

function messageOf(data: unknown, fallback: string): string {
  if (typeof data !== 'object' || data === null) return fallback;
  const { error, message } = data as { error?: unknown; message?: unknown };
  if (typeof error === 'string') return error;
  return typeof message === 'string' ? message : fallback;
}

function dateOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface CommentsProps {
  slug: string;
}

export function Comments({ slug }: CommentsProps): React.JSX.Element | null {
  const id = useId();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [sending, setSending] = useState<Sending>({ kind: 'idle' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [trap, setTrap] = useState('');
  const [token, setToken] = useState('');
  const [widgetFailed, setWidgetFailed] = useState(false);
  const challenge = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const started = useRef(false);
  const siteKey = load.kind === 'ready' ? load.siteKey : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/comments/${slug}`, { signal: controller.signal })
      .then(async (response) => {
        const data: unknown = response.ok ? await response.json().catch(() => null) : null;
        if (data === null) {
          setLoad({ kind: 'failed' });
          return;
        }
        const reply = readCommentsReply(data);
        setLoad({
          kind: 'ready',
          comments: reply.comments,
          siteKey: reply.siteKey,
          next: reply.next,
          more: 'idle',
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ kind: 'failed' });
      });
    return () => {
      controller.abort();
    };
  }, [slug]);

  const showMore = async (after: number): Promise<void> => {
    setLoad((before) => (before.kind === 'ready' ? { ...before, more: 'loading' } : before));
    try {
      const response = await fetch(`/comments/${slug}?after=${String(after)}`);
      const data: unknown = response.ok ? await response.json().catch(() => null) : null;
      if (data === null) throw new Error('No page');
      const reply = readCommentsReply(data);
      setLoad((before) =>
        before.kind === 'ready'
          ? {
              ...before,
              comments: mergeById(before.comments, reply.comments),
              next: reply.next,
              more: 'idle',
            }
          : before,
      );
    } catch {
      setLoad((before) => (before.kind === 'ready' ? { ...before, more: 'failed' } : before));
    }
  };

  // A Turnstile token works once, so every send (kept or refused) needs a fresh check.
  const freshCheck = (): void => {
    setToken('');
    if (widget.current !== null) window.turnstile?.reset(widget.current);
  };

  const startChallenge = (): void => {
    if (started.current || siteKey === null) return;
    started.current = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!challenge.current) return;
        widget.current = turnstile.render(challenge.current, {
          sitekey: siteKey,
          callback: setToken,
          'expired-callback': () => {
            setToken('');
          },
          'error-callback': () => {
            setToken('');
            setWidgetFailed(true);
          },
        });
      })
      .catch(() => {
        setWidgetFailed(true);
      });
  };

  const send = async (event: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (sending.kind === 'sending') return;
    setSending({ kind: 'sending' });
    try {
      const response = await fetch(`/comments/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, body, token, website: trap }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok) {
        setSending({ kind: 'sent', message: messageOf(data, 'Thank you.') });
        setName('');
        setEmail('');
        setBody('');
        freshCheck();
      } else {
        setSending({
          kind: 'failed',
          message: messageOf(data, 'The comment could not be sent. Try again in a moment.'),
        });
        freshCheck();
      }
    } catch {
      setSending({
        kind: 'failed',
        message: 'The comment could not be sent. Check the connection and try again.',
      });
      freshCheck();
    }
  };

  if (load.kind === 'loading' || load.kind === 'failed') return null;
  if (load.comments.length === 0 && siteKey === null) return null;

  const waitingForCheck = token === '' && !widgetFailed;

  return (
    <section className="comments" aria-labelledby={`${id}-heading`}>
      <h2 className="label" id={`${id}-heading`}>
        Comments
      </h2>

      {load.comments.length > 0 && (
        <ul className="comment-list">
          {load.comments.map((comment) => (
            <li key={comment.id}>
              <p className="comment-head">
                <strong>{comment.name}</strong>
                <time className="small quiet" dateTime={comment.createdAt}>
                  {dateOf(comment.createdAt)}
                </time>
              </p>
              <p className="comment-body">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {load.next !== null && (
        <div className="actions">
          <button
            type="button"
            className="control"
            disabled={load.more === 'loading'}
            onClick={() => {
              if (load.next !== null) void showMore(load.next);
            }}
          >
            {load.more === 'loading' ? 'Loading…' : 'Show more comments'}
          </button>
          {load.more === 'failed' && (
            <p className="small" role="alert">
              More comments could not be loaded. Try again.
            </p>
          )}
        </div>
      )}

      {siteKey !== null && (
        <form
          className="comment-form"
          onSubmit={(event) => {
            void send(event);
          }}
        >
          <h3 className="comment-ask">Add a comment</h3>
          <p className="small quiet">
            Victor reads every comment before it shows. Your email is optional, he alone sees it,
            and it is never shown here.
          </p>

          <div className="field">
            <label htmlFor={`${id}-name`}>Your name</label>
            <input
              id={`${id}-name`}
              type="text"
              name="name"
              onFocus={startChallenge}
              required
              maxLength={MAX_NAME}
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor={`${id}-email`}>
              Email <span className="quiet">(optional, only Victor sees it)</span>
            </label>
            <input
              id={`${id}-email`}
              type="email"
              name="email"
              onFocus={startChallenge}
              maxLength={MAX_EMAIL}
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor={`${id}-body`}>Your comment</label>
            <textarea
              id={`${id}-body`}
              name="body"
              onFocus={startChallenge}
              required
              rows={5}
              maxLength={MAX_BODY}
              value={body}
              onChange={(event) => {
                setBody(event.currentTarget.value);
              }}
            />
          </div>

          <div className="comment-trap" aria-hidden="true">
            <label>
              Leave this empty
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={trap}
                onChange={(event) => {
                  setTrap(event.currentTarget.value);
                }}
              />
            </label>
          </div>

          <div ref={challenge} className="comment-challenge" />

          <div className="actions">
            <button
              type="submit"
              className="control filled"
              disabled={sending.kind === 'sending' || waitingForCheck}
            >
              {sending.kind === 'sending' ? 'Sending…' : 'Send for Victor to read'}
            </button>
          </div>

          <p className="small status" role="status">
            {sending.kind === 'sent' && sending.message}
            {sending.kind === 'failed' && sending.message}
            {sending.kind !== 'sent' &&
              sending.kind !== 'failed' &&
              widgetFailed &&
              'The check that you are a person did not load. Reload the page and try again.'}
          </p>

          <p className="small quiet">
            What is kept: your name, your comment and, if you gave it, your email. To have any of it
            removed, write to <a href="mailto:info@victorsaly.com">info@victorsaly.com</a>.
          </p>
        </form>
      )}
    </section>
  );
}
