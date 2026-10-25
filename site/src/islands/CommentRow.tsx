// Why: one comment in the studio, with the email only Victor may see, under the title of the post it was left
// on. A waiting comment can be approved or deleted; an approved one can still be deleted, in case it was let
// through by mistake. Deleting is for good, so it always takes a second press, and it sits at the far end of
// the row, away from Approve, where a thumb will not find it by accident.
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
  /** The post's title, when it is known; the folder name otherwise. */
  title?: string | undefined;
  onApprove: (comment: OwnerComment) => void;
  onDelete: (comment: OwnerComment) => void;
}

export function CommentRow({
  comment,
  list,
  busy,
  title,
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
        On <a href={`/thoughts/${comment.slug}`}>{title ?? comment.slug}</a>
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
          className={confirming ? 'control filled delete' : 'control delete'}
          disabled={busy}
          onClick={() => {
            if (!confirming) setConfirming(true);
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
