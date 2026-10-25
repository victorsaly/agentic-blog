// Why: the live words are how Victor checks he is understood while he talks; a slip would drop words he said
// or show a guess twice.
import { describe, expect, it } from 'vitest';
import { heard, noWords } from './live-words';

const result = (transcript: string, final: boolean) => ({
  type: 'Results',
  is_final: final,
  channel: { alternatives: [{ transcript, confidence: 0.9 }] },
});

describe('heard', () => {
  it('replaces the guess as it hears more, and keeps what it is sure of', () => {
    let words = heard(noWords, result('September last year,', false));
    expect(words).toEqual({ kept: '', guess: 'September last year,' });
    words = heard(words, result('In September last year, I tried', false));
    expect(words.guess).toBe('In September last year, I tried');
    words = heard(words, result('In September last year, I tried to build a game.', true));
    expect(words).toEqual({ kept: 'In September last year, I tried to build a game.', guess: '' });
    words = heard(words, result('Using Claude and Cloudflare.', true));
    expect(words.kept).toBe(
      'In September last year, I tried to build a game. Using Claude and Cloudflare.',
    );
  });

  it('ignores what is not a result, and an empty final only clears the guess', () => {
    const words = { kept: 'Kept.', guess: 'maybe' };
    expect(heard(words, { type: 'Metadata', duration: 4.9 })).toBe(words);
    expect(heard(words, 'not json')).toBe(words);
    expect(heard(words, result('', true))).toEqual({ kept: 'Kept.', guess: '' });
  });
});
