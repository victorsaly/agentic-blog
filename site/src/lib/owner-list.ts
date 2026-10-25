// Why: the studio shows the comments waiting and the comments showing side by side, and one decision moves a
// comment between them. These pure steps keep both lists true after every approval, deletion and page, so a
// comment approved by mistake can be deleted straight away without reloading the page.
import { mergeById, type OwnerComment } from './comments';

export type OwnerListState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | {
      kind: 'ready';
      comments: OwnerComment[];
      /** Where the next page starts; null when everything is already here. */
      next: number | null;
      more: 'idle' | 'loading' | 'failed';
    };

export function readyList(comments: OwnerComment[], next: number | null): OwnerListState {
  return { kind: 'ready', comments, next, more: 'idle' };
}

export function without(state: OwnerListState, id: number): OwnerListState {
  return state.kind === 'ready'
    ? { ...state, comments: state.comments.filter((comment) => comment.id !== id) }
    : state;
}

/**
 * A comment just approved joins the showing list if it belongs in the part already loaded. Older ones
 * (below the next page's cursor) arrive with their own page instead.
 */
export function withApproved(state: OwnerListState, comment: OwnerComment): OwnerListState {
  if (state.kind !== 'ready') return state;
  if (state.next !== null && comment.id < state.next) return state;
  const approved: OwnerComment = { ...comment, status: 'approved' };
  return {
    ...state,
    comments: mergeById(state.comments, [approved]).sort((a, b) => b.id - a.id),
  };
}

export function withPage(
  state: OwnerListState,
  comments: OwnerComment[],
  next: number | null,
): OwnerListState {
  return state.kind === 'ready'
    ? { kind: 'ready', comments: mergeById(state.comments, comments), next, more: 'idle' }
    : state;
}

export function withMore(state: OwnerListState, more: 'loading' | 'failed'): OwnerListState {
  return state.kind === 'ready' ? { ...state, more } : state;
}
