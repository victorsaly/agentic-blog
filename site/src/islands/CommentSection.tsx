// Why: one of the studio's two comment lists (waiting, or showing under the posts). It shows what it is
// told, a page at a time, and says plainly when it is empty, still loading or could not be read.
import type { CommentStatus, OwnerComment } from '../lib/comments';
import type { OwnerListState } from '../lib/owner-list';
import { CommentRow } from './CommentRow';

export interface CommentSectionProps {
  list: CommentStatus;
  heading: string;
  hint?: string;
  empty: string;
  state: OwnerListState;
  busy: number | null;
  note: string;
  /** Post titles by folder name. */
  titles: Record<string, string>;
  onApprove: (comment: OwnerComment) => void;
  onDelete: (comment: OwnerComment) => void;
  onMore: () => void;
}

export function CommentSection({
  list,
  heading,
  hint,
  empty,
  state,
  busy,
  note,
  titles,
  onApprove,
  onDelete,
  onMore,
}: CommentSectionProps): React.JSX.Element {
  const headingId = `comments-${list}-label`;

  return (
    <section className="review" aria-labelledby={headingId}>
      <h2 className="label" id={headingId}>
        {heading}
      </h2>
      {hint !== undefined && <p className="small quiet">{hint}</p>}

      {state.kind === 'loading' && <p className="quiet">Looking for comments…</p>}
      {state.kind === 'failed' && <p role="alert">{state.message}</p>}

      {state.kind === 'ready' && (
        <div className="comments-review">
          {state.comments.length === 0 ? (
            <p className="quiet">{empty}</p>
          ) : (
            <ul>
              {state.comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  list={list}
                  busy={busy === comment.id}
                  title={titles[comment.slug]}
                  onApprove={onApprove}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}

          {state.next !== null && (
            <div className="actions">
              <button
                type="button"
                className="control"
                disabled={state.more === 'loading'}
                onClick={onMore}
              >
                {state.more === 'loading' ? 'Loading…' : 'Show more'}
              </button>
              {state.more === 'failed' && (
                <p className="small" role="alert">
                  The next page could not be read. Try again.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="small status" role="status" id={`comments-${list}-status`} tabIndex={-1}>
        {note}
      </p>
    </section>
  );
}
