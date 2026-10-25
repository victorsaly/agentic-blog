// Why: nothing a reader writes shows until Victor says so. This is the studio's list of comments, with the
// email only he may see. Waiting ones can be approved (they appear under the post) or deleted. Approved ones
// can still be deleted, in case one was let through by mistake; that takes a second press because readers
// can already see it. Each decision is on a single comment, so it takes effect at once and the row leaves the list.
import { useEffect, useState } from 'react';
import { readOwnerComments, type OwnerComment } from '../lib/comments';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; comments: OwnerComment[] }
  | { kind: 'failed'; message: string };

function errorOf(data: unknown, fallback: string): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : fallback;
}

function dateOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export interface CommentsReviewProps {
  status: 'pending' | 'approved';
}

export function CommentsReview({ status }: CommentsReviewProps): React.JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/comments?status=${status}`, { signal: controller.signal })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (response.ok) setLoad({ kind: 'ready', comments: readOwnerComments(data) });
        else
          setLoad({
            kind: 'failed',
            message: errorOf(data, 'The studio could not read the comments.'),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoad({
            kind: 'failed',
            message: 'The studio could not be reached. Check the connection.',
          });
      });
    return () => {
      controller.abort();
    };
  }, [status]);

  const decide = async (comment: OwnerComment, action: 'approve' | 'delete'): Promise<void> => {
    setBusy(comment.id);
    setConfirming(null);
    setNote('');
    try {
      const response = await fetch(`/api/comments/${String(comment.id)}`, {
        method: action === 'approve' ? 'POST' : 'DELETE',
        ...(action === 'approve'
          ? {
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'approve' }),
            }
          : {}),
      });
      const data: unknown = await response.json().catch(() => null);
      // A comment that is already gone is settled either way, so it leaves the list too.
      if (response.ok || response.status === 404) {
        setLoad((before) =>
          before.kind === 'ready'
            ? { kind: 'ready', comments: before.comments.filter((c) => c.id !== comment.id) }
            : before,
        );
        setNote(
          action === 'approve'
            ? `Approved. ${comment.name}'s comment is now under the post.`
            : `Deleted ${comment.name}'s comment.`,
        );
      } else setNote(errorOf(data, 'That did not work. Try again.'));
    } catch {
      setNote('The studio could not be reached. Check the connection.');
    } finally {
      setBusy(null);
    }
  };

  if (load.kind === 'loading') return <p className="quiet">Looking for comments…</p>;
  if (load.kind === 'failed') return <p role="alert">{load.message}</p>;

  return (
    <div className="comments-review">
      {load.comments.length === 0 ? (
        <p className="quiet">
          {status === 'pending' ? 'No comments waiting.' : 'No approved comments yet.'}
        </p>
      ) : (
        <ul>
          {load.comments.map((comment) => (
            <li key={comment.id}>
              <p className="head">
                <strong>{comment.name}</strong>
                {comment.email !== null && (
                  <a className="small" href={`mailto:${comment.email}`}>
                    {comment.email}
                  </a>
                )}
                <span className="small quiet">{dateOf(comment.createdAt)}</span>
              </p>
              <p className="small quiet">
                On <a href={`/thoughts/${comment.slug}`}>{comment.slug}</a>
              </p>
              <p className="text">{comment.body}</p>
              <div className="actions">
                {status === 'pending' && (
                  <button
                    type="button"
                    className="control filled"
                    disabled={busy === comment.id}
                    onClick={() => {
                      void decide(comment, 'approve');
                    }}
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  className={confirming === comment.id ? 'control filled' : 'control'}
                  disabled={busy === comment.id}
                  onClick={() => {
                    if (status === 'approved' && confirming !== comment.id)
                      setConfirming(comment.id);
                    else void decide(comment, 'delete');
                  }}
                  onBlur={() => {
                    setConfirming((now) => (now === comment.id ? null : now));
                  }}
                >
                  {confirming === comment.id ? 'Delete for good' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="small status" role="status">
        {note}
      </p>
    </div>
  );
}
