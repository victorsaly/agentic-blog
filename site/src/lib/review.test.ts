// Why: the studio's review list is how Victor knows what an agent wrote that he has not read; a version
// missing from it would reach readers unchecked without anyone noticing.
import { describe, expect, it } from 'vitest';
import { waitingForReview } from './review.js';

const thoughts = [
  { slug: '2026-10-22-a', title: 'Older', date: new Date('2026-10-22') },
  { slug: '2026-10-23-b', title: 'Newer', date: new Date('2026-10-23') },
];

describe('waitingForReview', () => {
  it('lists what is unreviewed, newest thought first, in reading order, with where it shows', () => {
    const list = waitingForReview(
      thoughts,
      [
        { slug: '2026-10-23-b', leaf: 'linkedin', kind: 'linkedin', reviewed: false },
        { slug: '2026-10-23-b', leaf: 'short', kind: 'short', reviewed: false },
        { slug: '2026-10-23-b', leaf: 'long', kind: 'long', reviewed: true },
        { slug: '2026-10-22-a', leaf: 'es', kind: 'language', reviewed: false },
      ],
      [{ slug: '2026-10-23-b', reviewed: false }],
    );
    expect(list).toEqual([
      {
        slug: '2026-10-23-b',
        title: 'Newer',
        waiting: [
          {
            file: 'thoughts/2026-10-23-b/versions/short.md',
            name: 'The idea',
            href: '/thoughts/2026-10-23-b#idea',
          },
          { file: 'thoughts/2026-10-23-b/versions/linkedin.md', name: 'The LinkedIn post' },
          { file: 'thoughts/2026-10-23-b/sources.md', name: 'The sources' },
        ],
      },
      {
        slug: '2026-10-22-a',
        title: 'Older',
        waiting: [{ file: 'thoughts/2026-10-22-a/versions/es.md', name: 'The version in es' }],
      },
    ]);
  });

  it('leaves out a thought once everything in it is reviewed', () => {
    expect(
      waitingForReview(
        thoughts,
        [{ slug: '2026-10-23-b', leaf: 'short', kind: 'short', reviewed: true }],
        [{ slug: '2026-10-23-b', reviewed: true }],
      ),
    ).toEqual([]);
  });
});
