// Why: the studio's review list is how Victor knows what an agent wrote that he has not read; a version
// missing from it would reach readers unchecked without anyone noticing.
import { describe, expect, it } from 'vitest';
import {
  isUnreviewed,
  markReviewed,
  readReviewRequest,
  reviewableIn,
  reviewableName,
  reviewableRank,
  waitingForReview,
} from './review.js';

const thoughts = [
  { slug: '2026-10-22-a', title: 'Older', date: new Date('2026-10-22'), draft: false },
  { slug: '2026-10-23-b', title: 'Newer', date: new Date('2026-10-23'), draft: false },
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
      [],
    );
    expect(list).toEqual([
      {
        slug: '2026-10-23-b',
        title: 'Newer',
        draft: false,
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
        draft: false,
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
        [{ slug: '2026-10-23-b', leaf: 'short', reviewed: true, audio: '/a.mp3' }],
      ),
    ).toEqual([]);
  });

  it('keeps a draft thought in the list, with no links, since it has no public page yet', () => {
    expect(
      waitingForReview(
        [{ slug: '2026-10-24-c', title: 'Draft', date: new Date('2026-10-24'), draft: true }],
        [{ slug: '2026-10-24-c', leaf: 'short', kind: 'short', reviewed: false }],
        [{ slug: '2026-10-24-c', reviewed: false }],
        [],
      ),
    ).toEqual([
      {
        slug: '2026-10-24-c',
        title: 'Draft',
        draft: true,
        waiting: [
          { file: 'thoughts/2026-10-24-c/versions/short.md', name: 'The idea' },
          { file: 'thoughts/2026-10-24-c/sources.md', name: 'The sources' },
        ],
      },
    ]);
  });

  it("carries each file's words, so a draft and the sources can be read in the studio", () => {
    const [draft] = waitingForReview(
      [{ slug: '2026-10-24-c', title: 'Draft', date: new Date('2026-10-24'), draft: true }],
      [
        {
          slug: '2026-10-24-c',
          leaf: 'short',
          kind: 'short',
          reviewed: false,
          body: '\nThe **idea**.\n',
        },
      ],
      [{ slug: '2026-10-24-c', reviewed: false, body: '- [A book](https://example.org)' }],
      [],
    );
    expect(draft?.waiting.map((w) => w.text)).toEqual([
      'The **idea**.',
      '- [A book](https://example.org)',
    ]);
  });

  it('lists an unreviewed recording with its audio, since the post will not play it yet', () => {
    expect(
      waitingForReview(
        thoughts,
        [{ slug: '2026-10-23-b', leaf: 'short', kind: 'short', reviewed: true }],
        [{ slug: '2026-10-23-b', reviewed: false }],
        [
          { slug: '2026-10-23-b', leaf: 'short', reviewed: false, audio: '/_astro/short.mp3' },
          { slug: '2026-10-22-a', leaf: 'short', reviewed: false },
        ],
      ),
    ).toEqual([
      {
        slug: '2026-10-23-b',
        title: 'Newer',
        draft: false,
        waiting: [
          {
            file: 'thoughts/2026-10-23-b/voice/short.md',
            name: 'The idea, read aloud',
            listen: '/_astro/short.mp3',
          },
          { file: 'thoughts/2026-10-23-b/sources.md', name: 'The sources' },
        ],
      },
      {
        slug: '2026-10-22-a',
        title: 'Older',
        draft: false,
        waiting: [{ file: 'thoughts/2026-10-22-a/voice/short.md', name: 'The idea, read aloud' }],
      },
    ]);
  });
});

describe('readReviewRequest', () => {
  it('takes versions, recordings and sources of a thought, and nothing else', () => {
    expect(
      readReviewRequest({
        files: [
          'thoughts/2026-10-23-b/versions/short.md',
          'thoughts/2026-10-23-b/voice/short.md',
          'thoughts/2026-10-23-b/sources.md',
        ],
      }),
    ).toEqual({
      ok: true,
      files: [
        'thoughts/2026-10-23-b/sources.md',
        'thoughts/2026-10-23-b/versions/short.md',
        'thoughts/2026-10-23-b/voice/short.md',
      ],
    });
    for (const bad of [
      'thoughts/2026-10-23-b/origin/text.md',
      'thoughts/2026-10-23-b/voice/short.mp3',
      'thoughts/2026-10-23-b/diagram/diagrams.md',
      'thoughts/2026-10-23-b/structure.md',
      'thoughts/2026-10-23-b/versions/../origin/text.md',
      'settings.yml',
    ])
      expect(readReviewRequest({ files: [bad] }).ok).toBe(false);
    expect(readReviewRequest({ files: [] }).ok).toBe(false);
    expect(readReviewRequest(null).ok).toBe(false);
  });
});

describe('markReviewed', () => {
  it('turns only the front matter flag, leaving every other byte as it was', () => {
    const before =
      '---\nwhy: >\n  A why.\nreviewed: false\n---\n\nreviewed: false stays in the text.\n';
    expect(markReviewed(before)).toBe(
      '---\nwhy: >\n  A why.\nreviewed: true\n---\n\nreviewed: false stays in the text.\n',
    );
    expect(markReviewed('---\nreviewed: true\n---\nText')).toBeNull();
    expect(markReviewed('No front matter.')).toBeNull();
  });
});

describe('marking with the merge approval', () => {
  const slug = '2026-11-07-okay-every-time-build';

  it('knows a file still waiting from one already reviewed', () => {
    expect(isUnreviewed('---\nwhy: x\nreviewed: false\n---\nBody')).toBe(true);
    expect(isUnreviewed('---\nwhy: x\nreviewed: true\n---\nBody')).toBe(false);
  });

  it('names each kind of file the way the review list does', () => {
    const name = (f: string) => reviewableName(`thoughts/${slug}/${f}`);
    expect(name('versions/short.md')).toBe('The idea');
    expect(name('versions/long.md')).toBe('The road');
    expect(name('versions/linkedin.md')).toBe('The LinkedIn post');
    expect(name('versions/es.md')).toBe('The version in es');
    expect(name('voice/short.md')).toBe('The idea, read aloud');
    expect(name('sources.md')).toBe('The sources');
  });

  it('orders them the way the review list does', () => {
    const files = [
      'sources.md',
      'versions/linkedin.md',
      'voice/short.md',
      'versions/es.md',
      'versions/long.md',
      'versions/short.md',
    ].map((f) => `thoughts/${slug}/${f}`);
    expect(
      [...files]
        .sort((a, b) => reviewableRank(a) - reviewableRank(b))
        .map((f) => f.split(`${slug}/`)[1]),
    ).toEqual([
      'versions/short.md',
      'versions/long.md',
      'versions/linkedin.md',
      'versions/es.md',
      'voice/short.md',
      'sources.md',
    ]);
  });

  it("takes only this post's reviewable files", () => {
    const long = `thoughts/${slug}/versions/long.md`;
    expect(reviewableIn([long, long], slug)).toEqual({ ok: true, files: [long] });
    expect(reviewableIn(['thoughts/2026-10-25-other/versions/long.md'], slug)).toMatchObject({
      ok: false,
    });
    expect(reviewableIn([`thoughts/${slug}/structure.md`], slug)).toMatchObject({ ok: false });
  });
});
