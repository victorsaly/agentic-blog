// Why: the studio links Victor to the pull request his send opened; picking an older one, or one opened for
// something else, would send him to the wrong thought.
import { describe, expect, it } from 'vitest';
import { pullOpenedSince } from './opened-pull';

const pull = (number: number, created: string, label = 'origin') => ({
  number,
  html_url: `https://github.com/o/r/pull/${String(number)}`,
  created_at: created,
  labels: [{ name: label }],
});

describe('pullOpenedSince', () => {
  const asked = '2026-10-25T21:05:00Z';

  it('finds the newest pull request with the label, opened since the send', () => {
    const listed = [
      pull(115, '2026-10-25T20:00:00Z'),
      pull(116, '2026-10-25T21:05:40Z'),
      pull(117, '2026-10-25T21:06:00Z', 'feedback'),
    ];
    expect(pullOpenedSince(listed, 'origin', asked)).toEqual({
      number: 116,
      url: 'https://github.com/o/r/pull/116',
    });
  });

  it('finds nothing until GitHub has opened it, and nothing in an answer that is not a list', () => {
    expect(pullOpenedSince([pull(115, '2026-10-25T20:00:00Z')], 'origin', asked)).toBeNull();
    expect(pullOpenedSince({ message: 'Bad credentials' }, 'origin', asked)).toBeNull();
  });
});
