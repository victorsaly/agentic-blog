// Why: a filter that hides the wrong ideas, or marks the wrong words, misleads a reader walking the graph.
import { describe, expect, it } from 'vitest';
import { matchingIdeas, segmentsOf, termsOf } from './graph-filter.js';

const ideas = [
  { id: 'a', text: 'Pictures in one hand: monochrome, lines and dots' },
  { id: 'b', text: 'A badge that says tidied, not made' },
  { id: 'c', text: 'Keep the raw note; everything else is tidied from it' },
];

describe('termsOf', () => {
  it('keeps the words that can match, stemmed, and nothing for stop words alone', () => {
    expect(termsOf('the pictures')).toEqual(['pictur']);
    expect(termsOf('the and of')).toEqual([]);
  });
});

describe('matchingIdeas', () => {
  it('finds an idea by the start of a word, and needs every term', () => {
    expect([...matchingIdeas(termsOf('pict'), ideas)]).toEqual(['a']);
    expect([...matchingIdeas(termsOf('tidied'), ideas)]).toEqual(['b', 'c']);
    expect([...matchingIdeas(termsOf('tidied raw'), ideas)]).toEqual(['c']);
    expect([...matchingIdeas(termsOf('zebra'), ideas)]).toEqual([]);
  });

  it('matches everything when there is nothing to match', () => {
    expect(matchingIdeas([], ideas).size).toBe(3);
  });
});

describe('segmentsOf', () => {
  it('marks the words that begin with a term and keeps the rest, spaces and marks included', () => {
    expect(segmentsOf('A badge that says tidied, not made', termsOf('tidied badge'))).toEqual([
      { text: 'A ', hit: false },
      { text: 'badge', hit: true },
      { text: ' that says ', hit: false },
      { text: 'tidied,', hit: true },
      { text: ' not made', hit: false },
    ]);
  });

  it('marks a hyphenated word by any of its parts, as matching does', () => {
    const text = 'We hide AI-assisted work';
    expect(matchingIdeas(termsOf('assisted'), [{ id: 'x', text }]).has('x')).toBe(true);
    expect(segmentsOf(text, termsOf('assisted'))).toEqual([
      { text: 'We hide ', hit: false },
      { text: 'AI-assisted', hit: true },
      { text: ' work', hit: false },
    ]);
  });

  it('marks nothing when there are no terms', () => {
    expect(segmentsOf('Keep the raw note', [])).toEqual([
      { text: 'Keep the raw note', hit: false },
    ]);
  });
});
