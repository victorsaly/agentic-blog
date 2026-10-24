// Why: the voice must say what the page shows. These tests pin what counts as "spoken" and how the voice
// service's per-character clock becomes a per-word one.
import { describe, expect, it } from 'vitest';
import {
  clockMatches,
  durationOf,
  fingerprint,
  spokenText,
  wordCount,
  wordsFromClock,
  type TimedWord,
} from './script.js';

const domain = 'blog.victorsaly.com';

describe('spokenText', () => {
  it('drops the front matter, the badge line and the Markdown marks', () => {
    const markdown = [
      '---',
      'why: Because.',
      '---',
      '',
      '# A **bold** idea',
      '',
      'Read [this link](https://example.com) and `code`.',
      '',
      '- one',
      '- two',
      '',
      'Talked out loud. See blog.victorsaly.com for the origin.',
    ].join('\n');
    expect(spokenText(markdown, domain)).toBe('A bold idea\n\nRead this link and code.\n\none two');
  });

  it('speaks inline code and in-word underscores as written', () => {
    expect(spokenText('Call `get_user_id`.', domain)).toBe('Call get_user_id.');
    expect(spokenText('Use snake_case and my_var_name here.', domain)).toBe(
      'Use snake_case and my_var_name here.',
    );
    expect(spokenText('Keep `*args` and `__init__` and 42 apples.', domain)).toBe(
      'Keep *args and __init__ and 42 apples.',
    );
  });

  it('still drops real emphasis marks', () => {
    expect(spokenText('An _italic_ and *starred* and **bold** and __strong__ word.', domain)).toBe(
      'An italic and starred and bold and strong word.',
    );
  });

  it('is empty when nothing is left to say', () => {
    expect(spokenText('---\nwhy: x\n---\n\nblog.victorsaly.com\n', domain)).toBe('');
  });
});

describe('wordsFromClock', () => {
  const clock = {
    characters: Array.from('Hi you'),
    characterStartTimesSeconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
  };

  it('groups characters into words with a start and an end', () => {
    expect(wordsFromClock(clock)).toEqual([
      ['Hi', 0, 0.2],
      ['you', 0.3, 0.6],
    ]);
  });

  it('refuses a clock with a missing time', () => {
    expect(() => wordsFromClock({ ...clock, characterEndTimesSeconds: [0.1] })).toThrow(
      /incomplete/,
    );
  });

  it('knows how long the speech is', () => {
    expect(durationOf(wordsFromClock(clock))).toBe(0.6);
    expect(durationOf([])).toBe(0);
  });
});

describe('clockMatches', () => {
  const hi: TimedWord = ['Hi', 0, 1];
  const you: TimedWord = ['you', 1, 2];

  it('accepts the same words in order', () => {
    expect(clockMatches('Hi you', [hi, you])).toBe(true);
  });

  it('refuses a dropped, added or changed word', () => {
    expect(clockMatches('Hi you', [hi])).toBe(false);
    expect(clockMatches('Hi you', [hi, you, ['all', 2, 3]])).toBe(false);
    expect(clockMatches('Hi you', [hi, ['we', 1, 2]])).toBe(false);
  });
});

describe('wordCount and fingerprint', () => {
  it('counts words across paragraphs', () => {
    expect(wordCount('one two\n\nthree')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('changes when a single word changes', () => {
    expect(fingerprint('a b')).toBe(fingerprint('a b'));
    expect(fingerprint('a b')).not.toBe(fingerprint('a c'));
  });
});
