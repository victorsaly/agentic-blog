// Why: nothing a reader writes shows until Victor says so. This is the studio's comments: the ones waiting
// and the ones showing under the posts, in one place so a decision on one moves it to the other at once
// (approve it and it appears under "showing", where it can still be deleted if it was a mistake). Each
// decision is on a single comment and takes effect immediately; long lists load a page at a time.
import { useCallback, useEffect, useState } from 'react';
import { readOwnerPage, type CommentStatus, type OwnerComment } from '../lib/comments';
import {
  readyList,
  withApproved,
  withMore,
  withPage,
  without,
  type OwnerListState,
} from '../lib/owner-list';
import { CommentSection } from './CommentSection';
import { COMMENTS_CHANGED } from '../lib/studio-areas';

function errorOf(data: unknown, fallback: string): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : fallback;
}

interface Note {
  list: CommentStatus;
  text: string;
}

export interface CommentsReviewProps {
  /** Post titles by folder name, so each comment names its post the way the site does. */
  titles: Record<string, string>;
}

export function CommentsReview({ titles }: CommentsReviewProps): React.JSX.Element {
  const [pending, setPending] = useState<OwnerListState>({ kind: 'loading' });
  const [approved, setApproved] = useState<OwnerListState>({ kind: 'loading' });
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const setters: Record<CommentStatus, typeof setPending> = {
    pending: setPending,
    approved: setApproved,
  };

  const fetchPage = useCallback(
    async (list: CommentStatus, before: number | null, signal?: AbortSignal) => {
      const query = before === null ? '' : `&before=${String(before)}`;
      const response = await fetch(
        `/api/comments?status=${list}${query}`,
        signal === undefined ? {} : { signal },
      );
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorOf(data, 'The studio could not read the comments.'));
      return readOwnerPage(data);
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const lists: CommentStatus[] = ['pending', 'approved'];
    for (const list of lists) {
      const set = list === 'pending' ? setPending : setApproved;
      fetchPage(list, null, controller.signal)
        .then((page) => {
          set(readyList(page.comments, page.next));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          set({
            kind: 'failed',
            message:
              error instanceof Error && error.message !== 'Failed to fetch'
                ? error.message
                : 'The studio could not be reached. Check the connection.',
          });
        });
    }
    return () => {
      controller.abort();
    };
  }, [fetchPage]);

  const showMore = async (list: CommentStatus, state: OwnerListState): Promise<void> => {
    if (state.kind !== 'ready' || state.next === null) return;
    const set = setters[list];
    set((now) => withMore(now, 'loading'));
    try {
      const page = await fetchPage(list, state.next);
      set((now) => withPage(now, page.comments, page.next));
    } catch {
      set((now) => withMore(now, 'failed'));
    }
  };

  const decide = async (comment: OwnerComment, action: 'approve' | 'delete'): Promise<void> => {
    const from = comment.status;
    setBusy(comment.id);
    setNote(null);
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
        setters[from]((now) => without(now, comment.id));
        if (action === 'approve' && response.ok) setApproved((now) => withApproved(now, comment));
        window.dispatchEvent(new Event(COMMENTS_CHANGED));
        // The row is gone, so focus goes to the line that says what happened, not to the top of the page.
        requestAnimationFrame(() => {
          document.getElementById(`comments-${from}-status`)?.focus();
        });
        setNote({
          list: from,
          text:
            action === 'approve'
              ? `Approved. ${comment.name}'s comment is now under the post.`
              : `Deleted ${comment.name}'s comment.`,
        });
      } else setNote({ list: from, text: errorOf(data, 'That did not work. Try again.') });
    } catch {
      setNote({ list: from, text: 'The studio could not be reached. Check the connection.' });
    } finally {
      setBusy(null);
    }
  };

  const onApprove = (comment: OwnerComment): void => {
    void decide(comment, 'approve');
  };
  const onDelete = (comment: OwnerComment): void => {
    void decide(comment, 'delete');
  };

  return (
    <>
      <CommentSection
        list="pending"
        heading="Comments waiting"
        empty="No comments waiting."
        state={pending}
        busy={busy}
        titles={titles}
        note={note?.list === 'pending' ? note.text : ''}
        onApprove={onApprove}
        onDelete={onDelete}
        onMore={() => {
          void showMore('pending', pending);
        }}
      />
      <CommentSection
        list="approved"
        heading="Comments showing"
        hint="Approved by mistake? Delete it here and it leaves the post at once."
        empty="No approved comments yet."
        state={approved}
        busy={busy}
        titles={titles}
        note={note?.list === 'approved' ? note.text : ''}
        onApprove={onApprove}
        onDelete={onDelete}
        onMore={() => {
          void showMore('approved', approved);
        }}
      />
    </>
  );
}
