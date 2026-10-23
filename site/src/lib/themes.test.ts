// Why: the theme row is the site's only classification; a wrong count or label shows on every page.
import { describe, expect, it } from 'vitest';
import { themeCounts, themeLabel } from './themes.js';

describe('themeLabel', () => {
  it('reads like words, with AI in capitals', () => {
    expect(themeLabel('ai-changing-work')).toBe('AI changing work');
    expect(themeLabel('scalable-secure')).toBe('Scalable secure');
  });
});

describe('themeCounts', () => {
  it('counts each theme once per post, most used first', () => {
    expect(
      themeCounts([
        ['credibility', 'accountability'],
        ['credibility', 'credibility'],
        ['ai-changing-work'],
      ]),
    ).toEqual([
      ['credibility', 2],
      ['accountability', 1],
      ['ai-changing-work', 1],
    ]);
  });
});
