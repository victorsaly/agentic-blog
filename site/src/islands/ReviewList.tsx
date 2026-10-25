// Why: the studio's list of what the agents wrote that Victor has not read, with a way to say "read it" in
// place: tick the files, press one button, and a pull request flipping their flags is opened for him to
// merge. Without a script the list still shows each file and where it lives, so it can be done by hand. Each
// file can be read right here, as it reads rather than as Markdown source: a draft and the sources have no
// page to go to.
import { useId, useState } from 'react';
import type { ThoughtWaiting } from '../lib/review';
import { Markdown } from './Markdown';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; count: number; prUrl: string }
  | { kind: 'failed'; message: string };

function sent(data: unknown): { files: string[]; prUrl: string } | null {
  if (typeof data !== 'object' || data === null) return null;
  const { files, prUrl } = data as { files?: unknown; prUrl?: unknown };
  return Array.isArray(files) && typeof prUrl === 'string'
    ? { files: files.filter((f): f is string => typeof f === 'string'), prUrl }
    : null;
}

function errorOf(data: unknown): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : 'The studio could not reach GitHub just now.';
}

export interface ReviewListProps {
  waiting: ThoughtWaiting[];
}

export function ReviewList({ waiting }: ReviewListProps): React.JSX.Element {
  const id = useId();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const all = waiting.flatMap((t) => t.waiting.map((w) => w.file));

  const toggle = (file: string, on: boolean): void => {
    setPicked((before) => {
      const next = new Set(before);
      if (on) next.add(file);
      else next.delete(file);
      return next;
    });
  };

  const mark = async (): Promise<void> => {
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ files: [...picked] }),
      });
      const data: unknown = await response.json().catch(() => null);
      const ok = response.ok ? sent(data) : null;
      if (ok) {
        setStatus({ kind: 'sent', count: ok.files.length, prUrl: ok.prUrl });
        setPicked(new Set());
      } else setStatus({ kind: 'failed', message: errorOf(data) });
    } catch {
      setStatus({
        kind: 'failed',
        message: 'The studio could not be reached. Check the connection.',
      });
    }
  };

  if (all.length === 0)
    return (
      <p className="quiet">
        Nothing. Every version, every recording and every list of sources has been read.
      </p>
    );

  return (
    <div className="review-list">
      <p className="quiet">
        Readers see each of these versions with a &ldquo;Not reviewed yet&rdquo; tag; unreviewed
        sources stay hidden, and an unreviewed recording is not played on the post, so listen to it
        here. Tick what you have read or heard and mark it reviewed: a pull request is opened, and
        merging it puts each one on the post.
      </p>
      {waiting.map((t) => (
        <fieldset key={t.slug} className="thought">
          <legend>
            <a href={`/thoughts/${t.slug}`}>{t.title}</a>
          </legend>
          <ul>
            {t.waiting.map((w) => {
              const box = `${id}-${w.file}`;
              return (
                <li key={w.file}>
                  <input
                    type="checkbox"
                    id={box}
                    checked={picked.has(w.file)}
                    onChange={(event) => {
                      toggle(w.file, event.currentTarget.checked);
                    }}
                  />
                  <label htmlFor={box}>
                    <span className="name">{w.name}</span>
                    <code className="small">{w.file}</code>
                  </label>
                  {w.href && (
                    <a className="read" href={w.href}>
                      Read it
                    </a>
                  )}
                  {w.text !== undefined && (
                    <details className="read-here">
                      <summary>Read here</summary>
                      <Markdown text={w.text} />
                    </details>
                  )}
                  {w.listen && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption -- it reads the idea word for word, and the idea is its text
                    <audio
                      className="listen"
                      controls
                      preload="none"
                      src={w.listen}
                      aria-label={`${w.name}, ${t.title}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <div className="actions">
        <button
          type="button"
          className="control filled"
          disabled={picked.size === 0 || status.kind === 'sending'}
          onClick={() => {
            void mark();
          }}
        >
          {status.kind === 'sending'
            ? 'Opening a pull request…'
            : picked.size === 0
              ? 'Mark as reviewed'
              : `Mark ${String(picked.size)} as reviewed`}
        </button>
        <button
          type="button"
          className="control"
          onClick={() => {
            setPicked(picked.size === all.length ? new Set() : new Set(all));
          }}
        >
          {picked.size === all.length ? 'Untick all' : 'Tick all'}
        </button>
      </div>
      <p className="small status" role="status">
        {status.kind === 'sent' && (
          <>
            A pull request marking{' '}
            {status.count === 1 ? 'one file' : `${String(status.count)} files`} reviewed is on its
            way. <a href={status.prUrl}>Merge it on GitHub</a> to take the tags off.
          </>
        )}
        {status.kind === 'failed' && status.message}
      </p>
    </div>
  );
}
