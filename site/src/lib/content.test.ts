// Why: these helpers decide what a reader sees beside every title; a wrong word count or a broken slug
// would show on every page, so they are tested on their own.
import { describe, expect, it } from 'vitest';
import {
  excerpt,
  formatDate,
  leafOf,
  plainText,
  readingLabel,
  readingMinutes,
  splitFirstSentence,
  thoughtSlugOf,
} from './content.js';

describe('ids', () => {
  it('finds the thought slug and the leaf of a collection id', () => {
    expect(thoughtSlugOf('2026-10-23-talked-out-loud-tidied-by-ai/versions/long')).toBe(
      '2026-10-23-talked-out-loud-tidied-by-ai',
    );
    expect(leafOf('2026-10-23-talked-out-loud-tidied-by-ai/versions/long')).toBe('long');
  });

  it('refuses an empty id', () => {
    expect(() => thoughtSlugOf('')).toThrow();
  });
});

describe('reading time', () => {
  it('never says less than one minute', () => {
    expect(readingMinutes('a few words')).toBe(1);
  });

  it('rounds at 180 words a minute', () => {
    expect(readingMinutes('word '.repeat(720))).toBe(4);
  });

  it('labels in words', () => {
    expect(readingLabel(1)).toBe('one minute');
    expect(readingLabel(4)).toBe('four minutes');
    expect(readingLabel(14)).toBe('14 minutes');
  });
});

describe('text', () => {
  it('formats a date the British way', () => {
    expect(formatDate(new Date('2026-10-23T12:00:00Z'))).toBe('23 October 2026');
  });

  it('strips markdown for a description', () => {
    expect(plainText('## Title\n\nSome **bold** and a [link](https://x.y) here.')).toBe(
      'Title Some bold and a link here.',
    );
  });

  it('cuts an excerpt with an ellipsis', () => {
    expect(excerpt('one two three four', 2)).toBe('one two…');
    expect(excerpt('one two', 5)).toBe('one two');
  });
});

describe('first sentence', () => {
  it('splits a message at the end of its first sentence', () => {
    expect(splitFirstSentence('Keep the note. Everything else is a conversion of it.')).toEqual({
      first: 'Keep the note.',
      rest: 'Everything else is a conversion of it.',
    });
  });

  it('keeps a question or an exclamation as the first sentence', () => {
    expect(splitFirstSentence('What do we reward? The job goal must change.').first).toBe(
      'What do we reward?',
    );
  });

  it('returns the whole message when it is one sentence', () => {
    expect(splitFirstSentence('  One sentence, no full stop  ')).toEqual({
      first: 'One sentence, no full stop',
      rest: '',
    });
  });
});
