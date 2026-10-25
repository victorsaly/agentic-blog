// Why: one comment in the studio, with the email only Victor may see. A waiting comment can be approved or
// deleted. An approved one can still be deleted, in case it was let through by mistake; that takes a second
// press, because readers can already see it.
import { useState } from 'react';
import type { CommentStatus, OwnerComment } from '../lib/comments';

function dateOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export interface CommentRowProps {
  comment: OwnerComment;
  /** Which list the row sits in: waiting ones can be approved, showing ones need a second press to delete. */
  list: CommentStatus;
  busy: boolean;
  onApprove: (comment: OwnerComment) => void;
  onDelete: (comment: OwnerComment) => void;
}

export function CommentRow({
  comment,
  list,
  busy,
  onApprove,
  onDelete,
}: CommentRowProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);

  return (
    <li>
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
        {list === 'pending' && (
          <button
            type="button"
            className="control filled"
            disabled={busy}
            onClick={() => {
              onApprove(comment);
            }}
          >
            Approve
          </button>
        )}
        <button
          type="button"
          className={confirming ? 'control filled' : 'control'}
          disabled={busy}
          onClick={() => {
            if (list === 'approved' && !confirming) setConfirming(true);
            else onDelete(comment);
          }}
          onBlur={() => {
            setConfirming(false);
          }}
        >
          {confirming ? 'Delete for good' : 'Delete'}
        </button>
      </div>
    </li>
  );
}
