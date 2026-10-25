import { describe, expect, it } from 'vitest';
import type { OwnerComment } from './comments';
import { readyList, withApproved, withMore, withPage, without } from './owner-list';

function comment(id: number, status: OwnerComment['status'] = 'pending'): OwnerComment {
  return {
    id,
    name: `Reader ${String(id)}`,
    body: 'Hello',
    createdAt: '2026-10-25T08:00:00Z',
    slug: '2026-10-23-a-post',
    email: null,
    status,
  };
}

function ids(state: ReturnType<typeof readyList>): number[] {
  return state.kind === 'ready' ? state.comments.map((c) => c.id) : [];
}

describe('the studio lists', () => {
  it('removes a comment from a loaded list', () => {
    expect(ids(without(readyList([comment(3), comment(2)], null), 3))).toEqual([2]);
  });

  it('leaves a list that has not loaded alone', () => {
    expect(without({ kind: 'loading' }, 1)).toEqual({ kind: 'loading' });
  });

  it('puts a newly approved comment in its place, newest first, as approved', () => {
    const showing = withApproved(
      readyList([comment(5, 'approved'), comment(1, 'approved')], null),
      comment(3),
    );
    expect(ids(showing)).toEqual([5, 3, 1]);
    expect(showing.kind === 'ready' && showing.comments[1]?.status).toBe('approved');
  });

  it('does not add a comment twice', () => {
    expect(ids(withApproved(readyList([comment(3, 'approved')], null), comment(3)))).toEqual([3]);
  });

  it('leaves an older comment for the page that holds it', () => {
    const loaded = readyList([comment(12, 'approved'), comment(10, 'approved')], 10);
    expect(ids(withApproved(loaded, comment(4)))).toEqual([12, 10]);
  });

  it('adds a newer comment even when more pages follow', () => {
    expect(ids(withApproved(readyList([comment(10, 'approved')], 10), comment(14)))).toEqual([
      14, 10,
    ]);
  });

  it('adds the next page without repeating what is there', () => {
    const loading = withMore(readyList([comment(9), comment(8)], 8), 'loading');
    const more = withPage(loading, [comment(8), comment(7)], null);
    expect(ids(more)).toEqual([9, 8, 7]);
    expect(more.kind === 'ready' && more.more).toBe('idle');
    expect(more.kind === 'ready' && more.next).toBeNull();
  });

  it('notes that a page could not be fetched without losing the list', () => {
    const failed = withMore(readyList([comment(2)], 2), 'failed');
    expect(failed.kind === 'ready' && failed.more).toBe('failed');
    expect(ids(failed)).toEqual([2]);
  });
});
