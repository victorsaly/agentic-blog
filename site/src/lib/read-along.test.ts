import { describe, expect, it } from 'vitest';
import { alignWords, clock, isListenRequest, wordAt, type TimedWord } from './read-along';

describe('alignWords', () => {
  it('gives every letter on the page the spoken word it belongs to', () => {
    expect(alignWords(['We hide it.'], ['We', 'hide', 'it.'])).toEqual([
      [0, 0, null, 1, 1, 1, 1, null, 2, 2, 2],
    ]);
  });

  it('follows a word the page splits across a link or emphasis', () => {
    const owners = alignWords(['the ', 'AI', '-assisted work'], ['the', 'AI-assisted', 'work']);
    expect(owners?.[1]).toEqual([1, 1]);
    expect(owners?.[2]?.slice(0, 9)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(owners?.[2]?.at(-1)).toBe(2);
  });

  it('accepts the curly quotes and dashes the renderer prints for straight ones', () => {
    expect(alignWords(['don’t stop – think…'], ["don't", 'stop', '--', 'think...'])).not.toBeNull();
  });

  it('accepts a mark only one side has', () => {
    expect(alignWords(['“Yes”, he said'], ['Yes,', 'he', 'said'])).not.toBeNull();
    expect(alignWords(['Yes he said'], ['Yes,', 'he', 'said.'])).not.toBeNull();
  });

  it('refuses when the page says a word the voice does not', () => {
    expect(alignWords(['We hide AI work'], ['We', 'hide', 'work'])).toBeNull();
  });

  it('refuses when the page stops before the voice does', () => {
    expect(alignWords(['We hide'], ['We', 'hide', 'it'])).toBeNull();
  });

  it('refuses when a word changed', () => {
    expect(alignWords(['We show it'], ['We', 'hide', 'it'])).toBeNull();
  });
});

describe('wordAt', () => {
  const words: TimedWord[] = [
    ['We', 0, 0.16],
    ['hide', 0.256, 0.64],
    ['it', 0.8, 1],
  ];

  it('is the last word to have started', () => {
    expect(wordAt(words, 0)).toBe(0);
    expect(wordAt(words, 0.3)).toBe(1);
    expect(wordAt(words, 0.7)).toBe(1);
    expect(wordAt(words, 5)).toBe(2);
  });

  it('is none before the first word starts', () => {
    expect(wordAt([['Hi', 0.5, 1]], 0.2)).toBe(-1);
    expect(wordAt([], 1)).toBe(-1);
  });
});

describe('clock', () => {
  it('reads minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(96)).toBe('1:36');
    expect(clock(9.9)).toBe('0:09');
  });
});

describe('isListenRequest', () => {
  it.each([
    'play',
    'Play it',
    'play the short version',
    'Listen',
    'read it to me',
    'Can you read this aloud?',
    'please read it out loud',
    'tell me the story',
    'Tell me the short version.',
  ])('hears "%s" as a request to play', (q) => {
    expect(isListenRequest(q)).toBe(true);
  });

  it.each([
    'tell me',
    'What is the point of this post?',
    'tell me about the road',
    'read the road',
    'Where does this come from in the original note?',
    '',
  ])('leaves "%s" to the chat', (q) => {
    expect(isListenRequest(q)).toBe(false);
  });
});
