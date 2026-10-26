import { describe, expect, it } from 'vitest';
import { byTitle, kindLabel, mentions, pagesLabel, summaryOf } from './wiki';

describe('mentions', () => {
  it('finds the title as whole words, ignoring case and punctuation', () => {
    expect(mentions('I used only Copilot, nothing else.', ['GitHub Copilot', 'Copilot'])).toBe(
      true,
    );
    expect(mentions('the age of spiritual machines', ['The Age of Spiritual Machines'])).toBe(true);
  });

  it('does not match inside a longer word', () => {
    expect(mentions('Claudette was there', ['Claude'])).toBe(false);
  });

  it('ignores accents and empty names', () => {
    expect(mentions('Gödel, Escher, Bach', ['Godel'])).toBe(true);
    expect(mentions('anything', ['', '  '])).toBe(false);
  });
});

describe('summaryOf', () => {
  it('leaves out headings and cuts at about 28 words', () => {
    const body = `## Who\n\n${Array.from({ length: 40 }, (_, i) => `w${String(i)}`).join(' ')}`;
    const summary = summaryOf(body);
    expect(summary.startsWith('w0 w1')).toBe(true);
    expect(summary.endsWith('…')).toBe(true);
    expect(summary).not.toContain('Who');
  });
});

describe('labels and order', () => {
  it('names kinds and counts in plain words', () => {
    expect(kindLabel('book')).toBe('Book');
    expect(pagesLabel(1)).toBe('One page');
    expect(pagesLabel(3)).toBe('3 pages');
  });

  it('sorts A to Z without caring about case', () => {
    const pages = [{ data: { title: 'claude' } }, { data: { title: 'Bach' } }];
    expect(pages.sort(byTitle).map((p) => p.data.title)).toEqual(['Bach', 'claude']);
  });
});
